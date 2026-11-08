/** Restore only into a NEW named schema. No live table overwrite or deletion. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
export const CORE_TABLES=['material_versions','material_state','participants','participant_codes','task_starts','responses'];
export function readArchive(bytes){
 if(bytes.length>100*1024*1024||bytes.length<22)throw Error('Invalid backup size');const files=new Map();let p=0;
 while(p+30<bytes.length&&bytes.readUInt32LE(p)===0x04034b50){const compression=bytes.readUInt16LE(p+8),crc=bytes.readUInt32LE(p+14),size=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),start=p+30+n+extra,end=start+size,name=bytes.subarray(p+30,p+30+n).toString();if(compression!==0||end>bytes.length||!name||name.includes('/')||name.includes('\\')||files.has(name))throw Error('Invalid archive');const data=bytes.subarray(start,end);let c=0xffffffff;for(const x of data){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}if(((c^0xffffffff)>>>0)!==crc)throw Error('CRC mismatch');files.set(name,data);p=end}
 const end=bytes.length-22;if(bytes.readUInt32LE(end)!==0x06054b50||bytes.readUInt32LE(end+16)!==p||bytes.readUInt32LE(end+12)!==end-p)throw Error('Truncated archive');
 const m=JSON.parse(files.get('manifest.json')||'null');if(m?.format!=='ai-experiment-backup'||m.format_version!==1)throw Error('Unsupported backup');
 for(const name of ['data.json.gz','schema.sql','restore.mjs','README.txt'])if(!m.files?.[name])throw Error('Incomplete manifest');
 for(const [name,hash]of Object.entries(m.files)){const b=files.get(name);if(!b||crypto.createHash('sha256').update(b).digest('hex')!==hash)throw Error('Checksum mismatch: '+name)}
 const d=JSON.parse(zlib.gunzipSync(files.get('data.json.gz'),{maxOutputLength:512*1024*1024}));
 if(d.format!==m.format||d.format_version!==1||d.backup_id!==m.backup_id)throw Error('Data/manifest mismatch');for(const t of CORE_TABLES)if(!Array.isArray(d.tables?.[t])||d.tables[t].length!==m.counts[t])throw Error('Count mismatch: '+t);
 const ids=new Set(d.tables.participants.map(p=>p.participant_id));for(const t of ['participant_codes','task_starts','responses'])for(const r of d.tables[t])if(!ids.has(r.participant_id))throw Error('Broken participant reference');return {manifest:m,data:d,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
export async function restorePostgres(client,archive,schemaName,schemaSQL){
 if(!/^restore_[a-z0-9_]{1,48}$/.test(schemaName))throw Error('Use a NEW schema named restore_...');
 await client.query('BEGIN');try{await client.query('CREATE SCHEMA "'+schemaName+'"');await client.query('SET LOCAL search_path TO "'+schemaName+'"');await client.query(schemaSQL);
 for(const t of CORE_TABLES){const columns=(await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',[schemaName,t])).rows.map(r=>r.column_name);for(const row of archive.data.tables[t]){const keys=Object.keys(row);if(keys.some(k=>!columns.includes(k)))throw Error('Unknown column in '+t);await client.query('INSERT INTO "'+t+'" ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',keys.map(k=>row[k]))}const n=Number((await client.query('SELECT count(*) n FROM "'+t+'"')).rows[0].n);if(n!==archive.manifest.counts[t])throw Error('Restore count mismatch')}
 await client.query("SELECT setval(pg_get_serial_sequence('participant_codes','number'),COALESCE((SELECT max(number) FROM participant_codes),1),EXISTS(SELECT 1 FROM participant_codes))");
 // Preserve and document baseline materials even if no published version existed.
 await client.query('CREATE TABLE recovery_metadata (id text PRIMARY KEY,payload text NOT NULL)');await client.query("INSERT INTO recovery_metadata VALUES ('baseline_materials',$1)",[JSON.stringify(archive.data.baseline_materials)]);
 await client.query('COMMIT');return archive.manifest.counts;
 }catch(e){await client.query('ROLLBACK');throw e}
}
async function main(){const args=process.argv.slice(2),file=args[0];if(!file)throw Error('Usage: node restore-postgres.mjs backup.zip [--apply --schema restore_trial --expected-sha256 HASH]');const archive=readArchive(fs.readFileSync(file));const expected=args[args.indexOf('--expected-sha256')+1];if(args.includes('--expected-sha256')&&expected!==archive.sha256)throw Error('Archive SHA mismatch');
 console.log(JSON.stringify({sha256:archive.sha256,counts:archive.manifest.counts,mode:args.includes('--apply')?'new-schema restore':'validation only'}));if(!args.includes('--apply'))return;
 if(!args.includes('--schema')||!args.includes('--expected-sha256')||!process.env.RESTORE_DATABASE_URL)throw Error('Need RESTORE_DATABASE_URL, --schema and --expected-sha256');
 const {Client}=await import('pg');const c=new Client({connectionString:process.env.RESTORE_DATABASE_URL});await c.connect();try{const here=path.dirname(fileURLToPath(import.meta.url));const sql=fs.readFileSync(path.join(here,'../drizzle-postgres/0000_initial.sql'),'utf8');console.log(JSON.stringify(await restorePostgres(c,archive,args[args.indexOf('--schema')+1],sql)))}finally{await c.end()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Validation/restore failed. No existing schema was overwritten.');process.exitCode=1});
