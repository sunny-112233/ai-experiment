import {AsyncLocalStorage} from 'node:async_hooks';
import {Pool,types} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema.postgres';
// All experiment timestamps/counts are integers within JS's safe range.
types.setTypeParser(20,(s:string)=>{const n=Number(s);if(!Number.isSafeInteger(n))throw Error('Unsafe database integer');return n});
export function postgresSQL(input:string){
 // Compatibility boundary for the existing, parameterized SQL inventory. Never
 // interpolate request values. SQLite files/migrations are never sent to PG.
 let sql=input.trim().replace(/;$/,'');const ignore=/\bINSERT OR IGNORE\b/i.test(sql);
 sql=sql.replace(/\bINSERT OR IGNORE\b/i,'INSERT');
 if(ignore){const at=sql.search(/\bRETURNING\b/i);sql=at<0?sql+' ON CONFLICT DO NOTHING':sql.slice(0,at)+' ON CONFLICT DO NOTHING '+sql.slice(at)}
 let n=0;sql=sql.replace(/'(?:''|[^'])*'|\?/g,(part)=>part==='?'?'$'+(++n):part);
 if(/\bPRAGMA\b|`|\bAUTOINCREMENT\b/i.test(sql))throw Error('SQLite-only SQL is not supported');
 return sql;
}
export class PostgresDatabase{
 dialect='postgres';pool:any;orm:any;scope=new AsyncLocalStorage<any>();
 constructor(pool:any){this.pool=pool;this.orm=drizzle(pool,{schema})}
 prepare(input:string){const DB=this;let args:any[]=[];const self:any={_sql:input,bind(...values:any[]){args=values;return self},async all(){const r=await (DB.scope.getStore()||DB.pool).query(postgresSQL(input),args);return {results:r.rows}},async first(){return (await self.all()).results[0]||null},async run(){const r=await self.all();return r}};return self}
 async atomic<T>(key:string,fn:()=>Promise<T>,isolation='READ COMMITTED'):Promise<T>{
  if(this.scope.getStore())return fn();const c=await this.pool.connect();try{await c.query('BEGIN ISOLATION LEVEL '+isolation);await c.query("SET LOCAL statement_timeout = '20000'");await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);const value=await this.scope.run(c,fn);await c.query('COMMIT');return value}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async batch(statements:any[]){return this.atomic('batch:'+crypto.randomUUID(),async()=>{const out=[];for(const s of statements)out.push(await s.all());return out},'REPEATABLE READ')}
 async consistentSnapshot(tables:string[]){return this.atomic('snapshot:'+crypto.randomUUID(),async()=>{const out=[];for(const t of tables){if(!/^[a-z_]+$/.test(t))throw Error('Invalid table');const r=await this.prepare('SELECT * FROM "'+t+'" ORDER BY '+(t==='participants'?'rowid':t==='participant_codes'?'number':t==='material_versions'?'version_id':t==='material_state'?'id':'participant_id,task_id')).all();out.push({results:r.results.map((row:any)=>{const {rowid,...data}=row;return data})})}return out},'REPEATABLE READ')}
}
let database:PostgresDatabase;
export function getDatabase(){if(!database){if(!process.env.DATABASE_URL)throw Object.assign(new Error('数据库尚未配置'),{status:503});database=new PostgresDatabase(new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true}))}return database}
