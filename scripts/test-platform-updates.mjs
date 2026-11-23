import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../lib/runtime/postgres.ts';
import {env} from '../lib/runtime/vercel.ts';
import {POST as experiment} from '../app/api/experiment/route.ts';
import {POST as materials} from '../app/api/materials/route.ts';
import {editablePackage} from '../lib/material-versions.ts';
import {buildBackup} from '../lib/backups.ts';
import {readArchive,restorePostgres} from './restore-postgres.mjs';
const pg=new PGlite();await pg.exec(fs.readFileSync('drizzle-postgres/0000_initial.sql','utf8'));
let queue=Promise.resolve();
async function connect(){let release;const previous=queue;queue=new Promise(r=>release=r);await previous;return {query:async(sql,args)=>{if(!args&&/;\s*\S/.test(sql)){await pg.exec(sql);return {rows:[]}}return pg.query(sql,args)},release}}
const pool={connect,async query(sql,args){const c=await connect();try{return await c.query(sql,args)}finally{c.release()}}};
const DB=new PostgresDatabase(pool);Object.defineProperty(env,'DB',{value:DB});Object.defineProperty(env,'ADMIN_TOKEN',{value:'test-only-token'});Object.defineProperty(env,'BUCKET',{value:undefined});
const admin={admin_token:'test-only-token'};
async function call(api,body){const r=await api(new Request('https://test.local/api/'+(api===materials?'materials':'experiment'),{method:'POST',headers:{Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)}));const d=r.headers.get('Content-Type').includes('json')?await r.json():Buffer.from(await r.arrayBuffer());return {status:r.status,d}}
const request=body=>call(experiment,body);
const state=(await request({...admin,action:'recruitment-load'})).d;
assert.equal(state.groups.length,10);
assert.equal((await request({action:'recruitment-save',enabled:[],revision:0})).status,403);
let revision=0;
async function enable(enabled){const r=await request({...admin,action:'recruitment-save',revision,enabled});assert.equal(r.status,200,JSON.stringify(r.d));revision=r.d.revision;}
await enable([]);assert.equal((await request({action:'create'})).status,409);
await enable(state.groups.filter(g=>g.study===1).map(g=>g.id));
const sessions=[];
for(let i=0;i<8;i++){const r=await request({action:'create'});assert.equal(r.status,200,JSON.stringify(r.d));sessions.push(r.d)}
const resumed=await Promise.all(sessions.map(s=>request({...s,action:'resume'})));assert(resumed.every(r=>r.d.participant.study===1));
const counts=(await pool.query('SELECT group_id,count(*)::int n FROM participants GROUP BY group_id')).rows;assert.equal(counts[0].n,counts[1].n);
await enable(['s2-basicA-high']);
const timed=(await request({action:'create'})).d;const timedRecord=(await request({...timed,action:'resume'})).d;assert.equal(timedRecord.participant.study,2);assert.equal(timedRecord.participant.time_limit_ms,30000);
await enable(state.groups.filter(g=>g.study<=2).map(g=>g.id));
const many=await Promise.all(Array.from({length:12},()=>request({action:'create'})));assert(many.every(r=>r.status===200));for(const r of many){const own=(await request({...r.d,action:'resume'})).d;assert(own.participant.study<=2)}
const original=(await request({...sessions[0],action:'resume'})).d;assert.equal(original.participant.group_id,resumed[0].d.participant.group_id);
const loaded=(await call(materials,{...admin,action:'load'})).d;const draft=editablePackage(loaded.draft);
for(const study of Object.values(draft.studies))for(const m of Object.values(study)){m.tasks=m.tasks.slice(0,2).reverse();m.quiz=m.quiz.slice(0,1);}
draft.demographics=[{id:'custom',label:'自定义信息',required:true,options:['选项一']}];draft.aiVariables=[{id:'AI_TEST',question:'测试量表题',options:['非常不同意','不同意','一般','同意','非常同意']}];
draft.instructions={shared:{quiz:'共用测验说明',welcome:'更新欢迎语'},studies:{3:{quiz:'研究三测验说明'}}};
const invalid=structuredClone(draft);invalid.aiVariables[0].options.pop();assert.equal((await call(materials,{...admin,action:'save',revision:0,package:invalid})).status,400);
assert.equal((await call(materials,{...admin,action:'save',revision:0,package:draft})).status,200);
assert.equal((await call(materials,{...admin,action:'publish',revision:1})).status,200);
for(const stage of ['home','consent','training','task','demographics','quiz','aiVariables','done']){const preview=await call(materials,{...admin,action:'preview',package:draft,study:2,version:'A',material:'basicA',pressure:'high',stage});assert.equal(preview.status,200,JSON.stringify(preview.d));assert(preview.d.html.includes('function applyInstructions('));new vm.Script(preview.d.html.match(/<script>([\s\S]*?)<\/script>/)[1]);}
await enable(['s3-expertB']);
const s=(await request({action:'create'})).d;const d=(await request({...s,action:'resume'})).d;assert.equal(d.participant.study,3);assert.equal(d.materials.expertB.tasks.length,2);assert.equal(d.aiVariables.length,1);assert.equal(d.instructions.quiz,'研究三测验说明');assert.equal(s.instructions.welcome,'更新欢迎语');assert.notEqual((await request({...sessions[0],action:'resume'})).d.instructions.welcome,'更新欢迎语');
assert.equal((await request({...s,token:sessions[0].token,action:'resume'})).status,401);
await request({...s,action:'consent'});await request({...s,action:'training',duration_ms:1000});
for(const task of d.materials.expertB.tasks){await request({...s,action:'begin',task_id:task.task_id});const now=new Date().toISOString();const body={...s,action:'answer',task_id:task.task_id,adoption_score:6,response_time_ms:1000,timeout:false,task_presented_at:now,advice_fully_visible_at:now,client_submitted_at:now};const result=await request(body);assert.equal(result.status,200,JSON.stringify(result.d));assert.equal((await request(body)).d.duplicate,true)}
assert.equal((await request({...s,action:'demographics',demographics:{custom:'选项一'}})).status,200);
const quiz=[d.materials.expertB.quiz[0].options[0].value];assert.equal((await request({...s,action:'quiz',quiz})).status,200);
assert.equal((await request({...s,action:'resume'})).d.participant.completion_status,'ai_variables');
assert.equal((await request({...s,action:'finish',quiz})).status,400);
assert.equal((await request({...s,action:'finish',quiz,ai_variables:{AI_TEST:2}})).status,200);
assert.equal(JSON.parse((await request({...s,action:'resume'})).d.participant.ai_variables).AI_TEST,2);
assert.equal((await request({...admin,action:'admin',filters:{study:3},export:'xlsx'})).status,200);
assert.equal((await request({...s,action:'resume'})).d.answers.length,2);
assert.equal((await request({...sessions[0],action:'resume'})).d.answers.length,0);
assert.equal((await request({action:'admin',delete_participant_ids:[s.participant_id],confirm_delete:true})).status,403);
assert.equal((await request({...admin,action:'admin',delete_participant_ids:[s.participant_id],confirm_delete:false})).status,400);
const backup=await buildBackup(DB,'test-backup','manual');const archive=readArchive(Buffer.from(backup.bytes));assert(archive.data.tables.material_state.some(r=>r.id==='recruitment'));
const client=await connect();await restorePostgres(client,archive,'restore_updates',fs.readFileSync('drizzle-postgres/0000_initial.sql','utf8'));client.release();
assert.equal((await request({...admin,action:'admin',delete_participant_ids:[s.participant_id],confirm_delete:true})).status,200);
assert.equal((await request({...s,action:'resume'})).status,401);assert.equal((await request({...sessions[0],action:'resume'})).status,200);
await pg.close();console.log('PASS ten groups, selection/paused/single/multiple groups, balanced allocation, independent sessions, immutable snapshots, dynamic tasks and custom fields, AI measures/resume/validation, export, delete scope/auth, full backup and isolated restore.');
