import {instructionsFor} from '../../../lib/instructions';
import {GROUPS,RECRUITMENT_BATCH,recruitmentState} from '../../../lib/recruitment';
import {activePackage,packageFor,participantMaterial,editablePackage,checkAdmin} from '../../../lib/material-versions';
import {env,withRequest} from '#runtime';
import {makeWorkbook} from '../../../lib/xlsx';
import fields from '../../../lib/fields.json';
import materials from '../../../lib/materials.json';
export const dynamic='force-dynamic';
const DATA:any=materials;
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
const validMs=(v:any)=>Number.isInteger(v)&&v>=0&&v<=604800000;
async function codeFor(DB:any,pid:string){const existing=await DB.prepare('SELECT number FROM participant_codes WHERE participant_id=?').bind(pid).first();if(existing)return 'P'+String(existing.number).padStart(6,'0');await DB.prepare('INSERT OR IGNORE INTO participant_codes (participant_id) VALUES (?)').bind(pid).run();const c=await DB.prepare('SELECT number FROM participant_codes WHERE participant_id=?').bind(pid).first();return 'P'+String(c.number).padStart(6,'0')}
async function saveAnswerFast(DB:any,b:any){
 const began=Date.now();
 // Authenticate and fetch only the requested question's state in one database trip.
 const p:any=await DB.prepare(`SELECT p.*,(SELECT count(*) FROM responses c WHERE c.participant_id=p.participant_id) AS response_count,s.started_ms AS question_started_ms,r.task_id AS saved_task_id FROM participants p LEFT JOIN task_starts s ON s.participant_id=p.participant_id AND s.task_id=? LEFT JOIN responses r ON r.participant_id=p.participant_id AND r.task_id=? WHERE p.participant_id=? AND p.token_hash=?`).bind(b.task_id,b.task_id,b.participant_id,await hash(b.token)).first();
 if(!p)fail('会话凭据无效',401);
 const snapshot=await packageFor(DB,p.material_version),tasks=participantMaterial(snapshot,p).tasks;
 const duplicate=!!p.saved_task_id,position=Number(p.response_count),t=duplicate?tasks.find((q:any)=>q.task_id===b.task_id):tasks[position];
 if(!t||t.task_id!==b.task_id||(!duplicate&&p.completion_status!=='tasks'))fail('题目顺序无效');
 const statements:any[]=[];
 if(!duplicate){
  if(p.question_started_ms===null)fail('题目尚未开始');
  if(!validMs(b.response_time_ms)||!Number.isFinite(Date.parse(b.task_presented_at))||!Number.isFinite(Date.parse(b.client_submitted_at)))fail('作答时间无效');
  if(b.advice_fully_visible_at!==null&&!Number.isFinite(Date.parse(b.advice_fully_visible_at)))fail('回复时间无效');
  const elapsed=Date.now()-p.question_started_ms;
  const timed=!!b.timeout||(p.time_limit_ms!==null&&(elapsed>p.time_limit_ms+2000||b.response_time_ms>=p.time_limit_ms));
  const score=timed?null:b.adoption_score;if(!timed&&(!Number.isInteger(score)||score<1||score>7))fail('评分必须为1—7');
  statements.push(DB.prepare(`INSERT OR IGNORE INTO responses (participant_id,task_id,source_question_no,task_domain,task_position,scenario,ai_advice,advice_correctness,adoption_score,response_time_ms,server_elapsed_ms,timeout,missing,task_presented_at,advice_fully_visible_at,client_submitted_at,server_saved_at,animation_duration_ms,primary_outcome) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.participant_id,t.task_id,t.source_no,t.domain,position+1,t.scenario,t.advice,t.advice_correctness??null,score,b.response_time_ms,elapsed,timed?1:0,score===null?1:0,b.task_presented_at,b.advice_fully_visible_at,b.client_submitted_at,new Date().toISOString(),900,t.primary_outcome===undefined||t.primary_outcome===null?null:(t.primary_outcome?1:0)));
 }
 const next=tasks[position+(duplicate?0:1)];
 if(next)statements.push(DB.prepare('INSERT OR IGNORE INTO task_starts (participant_id,task_id,started_ms) VALUES (?,?,?)').bind(p.participant_id,next.task_id,Date.now()));
 const savedIndex=statements.length;
 statements.push(DB.prepare('SELECT * FROM responses WHERE participant_id=? AND task_id=?').bind(p.participant_id,t.task_id));
 if(next)statements.push(DB.prepare('SELECT started_ms FROM task_starts WHERE participant_id=? AND task_id=?').bind(p.participant_id,next.task_id));
 // Atomic: no successful save acknowledgement until both writes are durable.
 const results=await DB.batch(statements),saved=results[savedIndex].results[0];if(!saved)fail('保存尚未确认，请重试',503);
 let prepared=null;if(next){const start=results[savedIndex+1].results[0];prepared={task_id:next.task_id,started_ms:start.started_ms,remaining_ms:p.time_limit_ms===null?null:Math.max(0,p.time_limit_ms-(Date.now()-start.started_ms))}}
 const response=json({ok:true,answer:saved,next:prepared,...(duplicate?{duplicate:true}:{})});response.headers.set('Server-Timing','save;dur='+(Date.now()-began));return response;
}

async function handle(req:Request){try{
 const DB=env.DB!;if(!DB)fail('数据库暂不可用',503);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)fail('请求来源无效',403);
 if(Number(req.headers.get('content-length')||0)>131072)fail('请求过大',413);
 const raw=await req.text();if(raw.length>131072)fail('请求过大',413);const b=JSON.parse(raw);
 if(b.action==='create'){
  const token=crypto.randomUUID()+crypto.randomUUID();const pid='P_'+crypto.randomUUID();
  const active=await activePackage(DB);
  const recruitment=await recruitmentState(DB);
  const available=recruitment.groups.filter((g:any)=>recruitment.enabled.includes(g.id));
  if(!available.length)fail('当前暂未开放参与',409);
  const minimum=Math.min(...available.map((g:any)=>g.allocated));
  const candidates=available.filter((g:any)=>g.allocated===minimum);  const group=candidates[Math.floor(Math.random()*candidates.length)];
  // Pin an immutable study-specific snapshot before issuing a participant session.
  let version=active.version;
  if(!active.package.studies){
   version='PLATFORM-V2-'+active.version;
   await DB.prepare('INSERT OR IGNORE INTO material_versions(version_id,payload,published_at) VALUES (?,?,?)').bind(version,JSON.stringify(editablePackage(active.package)),new Date().toISOString()).run();
  }
  await DB.prepare('INSERT INTO participants (participant_id,token_hash,study,training_domain,training_type,questionnaire_version,material_key,time_pressure,time_limit_ms,material_version,recruitment_batch,mode,started_at,completion_status,group_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,await hash(token),group.study,group.material.endsWith('A')?'medical':'outdoor',group.material.startsWith('expert')?'professional':'common_sense',group.material.slice(-1),group.material,group.pressure,group.pressure==='high'?30000:null,version,RECRUITMENT_BATCH,'formal',new Date().toISOString(),'entry',group.id).run();
  return json({participant_id:pid,participant_code:await codeFor(DB,pid),token,instructions:instructionsFor(active.package,group.study)});
 }
 if(b.action==='recruitment-load'||b.action==='recruitment-save'){
  if(!await checkAdmin(env,b.admin_token))fail('后台访问口令错误',403);
  const current=await recruitmentState(DB);
  if(b.action==='recruitment-load')return json(current);
  if(b.revision!==current.revision)fail('设置已被其他页面更新，请刷新后重试',409);
  if(!Array.isArray(b.enabled)||b.enabled.some((id:any)=>!GROUPS.some(g=>g.id===id))||new Set(b.enabled).size!==b.enabled.length)fail('开放组无效');
  await DB.prepare("INSERT INTO material_state(id,draft,revision,updated_at) VALUES ('recruitment',?,?,?) ON CONFLICT(id) DO UPDATE SET draft=excluded.draft,revision=excluded.revision,updated_at=excluded.updated_at").bind(JSON.stringify({enabled:b.enabled}),current.revision+1,new Date().toISOString()).run();
  const response=json(await recruitmentState(DB));response.headers.set('X-Backup-Trigger','recruitment-updated');return response;
 }
 if(b.action==='admin'){
  const secret=(env as any).ADMIN_TOKEN;if(!secret||typeof b.admin_token!=='string'||await hash(secret)!==await hash(b.admin_token))fail('后台访问口令错误',403);
  if(b.delete_participant_ids!==undefined){
   const ids=b.delete_participant_ids;
   if(b.confirm_delete!==true||!Array.isArray(ids)||!ids.length||ids.length>2000||ids.some((id:any)=>typeof id!=='string')||new Set(ids).size!==ids.length)fail('删除选择无效');
   const marks=ids.map(()=>'?').join(',');
   const statements=['responses','task_starts','participant_codes','participants'].map(table=>DB.prepare('DELETE FROM '+table+' WHERE participant_id IN ('+marks+')').bind(...ids));
   await DB.batch(statements);return json({ok:true,deleted:ids.length});
  }
  if(b.detail_participant_id!==undefined){
   if(typeof b.detail_participant_id!=='string')fail('被试编号无效');
   const person:any=await DB.prepare('SELECT * FROM participants WHERE participant_id=?').bind(b.detail_participant_id).first();if(!person)fail('记录不存在',404);delete person.token_hash;delete person.rowid;person.participant_code=await codeFor(DB,person.participant_id);
   const records=await DB.prepare('SELECT * FROM responses WHERE participant_id=? ORDER BY task_position').bind(person.participant_id).all();return json({participant:person,answers:records.results});
  }
  const f=b.filters||{};const conditions:string[]=[],args:any[]=[];
  if(f.study!==undefined&&f.study!==''){if(![1,2,3].includes(Number(f.study)))fail('研究筛选无效');conditions.push('p.study=?');args.push(Number(f.study))}
  if(f.mode){if(!['formal','test'].includes(f.mode))fail('数据类型无效');conditions.push('p.mode=?');args.push(f.mode)}
  if(f.group_id){if(!GROUPS.some(g=>g.id===f.group_id))fail('组别无效');conditions.push('p.group_id=?');args.push(f.group_id)}
  if(f.material_key!==undefined&&f.material_key!==''){if(!['basicA','basicB','expertA','expertB'].includes(f.material_key))fail('培训内容筛选无效');conditions.push('p.material_key=?');args.push(f.material_key)}
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  if(b.export==='responses'||b.export==='xlsx'){
   const r=await DB.prepare(`SELECT p.participant_id,p.study,p.training_domain,p.training_type,p.questionnaire_version,p.time_pressure,p.time_limit_ms,p.material_version,p.recruitment_batch,p.mode,p.group_id,p.ai_variables,p.started_at,p.training_duration_ms,p.completion_status,p.demographics,p.knowledge_quiz,p.completed_at,r.task_id,r.source_question_no,r.task_domain,r.task_position,r.scenario,r.ai_advice,r.advice_correctness,r.adoption_score,r.response_time_ms,r.server_elapsed_ms,r.timeout,r.missing,r.task_presented_at,r.advice_fully_visible_at,r.client_submitted_at,r.server_saved_at,r.animation_duration_ms,r.primary_outcome FROM participants p JOIN responses r ON r.participant_id=p.participant_id ${where} ORDER BY p.started_at DESC,p.rowid DESC,r.task_position`).bind(...args).all();
   if(b.participant_ids!==undefined&&(!Array.isArray(b.participant_ids)||b.participant_ids.length>2000||b.participant_ids.some((v:any)=>typeof v!=='string')))fail('被试选择无效');
   const chosen=b.participant_ids?new Set(b.participant_ids):null;
   const rows:any[]=r.results.filter((x:any)=>!chosen||chosen.has(x.participant_id));const codeMap=new Map();
   for(const row of rows){if(!codeMap.has(row.participant_id))codeMap.set(row.participant_id,await codeFor(DB,row.participant_id));row.participant_code=codeMap.get(row.participant_id);row.response_time_seconds=row.response_time_ms/1000}
   if(b.export==='responses')return json(rows);
   const people:any[]=(await DB.prepare('SELECT p.* FROM participants p'+where+' ORDER BY p.started_at DESC,p.rowid DESC').bind(...args).all()).results.filter((x:any)=>!chosen||chosen.has(x.participant_id));
   for(const p of people){p.participant_code=codeMap.get(p.participant_id)||await codeFor(DB,p.participant_id);delete p.token_hash;const demo=JSON.parse(p.demographics||'{}');for(const field of ['sex','age','education'])if(demo[field]!==undefined)p[field]=demo[field];const quiz=JSON.parse(p.knowledge_quiz||'[]');quiz.forEach((v:any,i:number)=>p['quiz_'+(i+1)]=v)}
   const snapshots=await Promise.all(people.map(p=>packageFor(DB,p.material_version)));
   const extraKeys=new Set<string>(['group_id','ai_variables']);
   people.forEach((p,i)=>{const snapshot=snapshots[i];for(const f of snapshot.demographics){const source=f.id==='edu'?'education':f.id;const key=['sex','age','education'].includes(source)?source:'demo_'+source;p[key]=JSON.parse(p.demographics||'{}')[source]??null;extraKeys.add(key);}const own=participantMaterial(snapshot,p);const quiz=JSON.parse(p.knowledge_quiz||'[]');own.quiz.forEach((q:any,j:number)=>{const id=q.id||'legacy_'+(j+1);p['quiz_'+id]=quiz[j]??null;extraKeys.add('quiz_'+id)});const vars=JSON.parse(p.ai_variables||'{}');for(const q of snapshot.aiVariables||[]){p['ai_'+q.id]=vars[q.id]??null;extraKeys.add('ai_'+q.id)}});
   const baseKeys=['participant_code','participant_id','study','training_domain','training_type','questionnaire_version','time_pressure','time_limit_ms','material_version','recruitment_batch','mode','started_at','training_duration_ms','completion_status','completed_at','sex','age','education','quiz_1','quiz_2','quiz_3','quiz_4','quiz_5',...extraKeys];
   const taskFields=['adoption_score','response_time_ms','response_time_seconds','timeout','missing','task_position','server_elapsed_ms','task_presented_at','advice_fully_visible_at','client_submitted_at','server_saved_at','advice_correctness','primary_outcome'];
   const taskIds=[...new Set<string>([...rows.map(r=>r.task_id),...people.flatMap((p,i)=>participantMaterial(snapshots[i],p).tasks.map((t:any)=>t.task_id))])];
   const headers=[...baseKeys,...taskIds.flatMap(id=>taskFields.map(f=>id+'_'+f))];
   const answersByParticipant=new Map<string,Map<string,any>>();for(const r of rows){if(!answersByParticipant.has(r.participant_id))answersByParticipant.set(r.participant_id,new Map());answersByParticipant.get(r.participant_id)!.set(r.task_id,r)}
   const wide=people.map(p=>{const own=answersByParticipant.get(p.participant_id);return [...baseKeys.map(k=>p[k]??null),...taskIds.flatMap(id=>taskFields.map(f=>own?.get(id)?.[f]??null))]});
   const dictionary=[...fields.filter(f=>!taskFields.includes(f.field)),...taskIds.flatMap(id=>taskFields.map(f=>{const info=fields.find(x=>x.field===f);return {field:id+'_'+f,label:id+' '+(info?.label||f),coding:info?.coding||'未作答为空；超时评分为空，不能记作0分'}}))];
   for(let i=1;i<=5;i++)dictionary.push({field:'quiz_'+i,label:'知识测验第'+i+'题',coding:'A/B/C/D；未完成为空'});
   const seen=new Set();const questions=rows.filter(r=>{const key=r.material_version+'|'+r.questionnaire_version+'|'+r.training_type+'|'+r.task_id;if(seen.has(key))return false;seen.add(key);return true}).map(r=>[r.material_version,r.questionnaire_version,r.training_type,r.task_id,r.task_domain,r.scenario,r.ai_advice]);
   const supplement=snapshots.flatMap((snapshot,i)=>[...participantMaterial(snapshot,people[i]).quiz.map((q:any,j:number)=>[people[i].study,people[i].material_version,'知识测验',q.id||'legacy_'+(j+1),q.question,JSON.stringify(q.options)]),...(snapshot.aiVariables||[]).map((q:any)=>[people[i].study,people[i].material_version,'AI相关变量',q.id,q.question,JSON.stringify(q.options)])]);
   const bytes=makeWorkbook([{name:'补充题目说明',rows:[['study','material_version','section','question_id','question','options'],...supplement]},{name:'被试数据',rows:[headers,...wide]},{name:'题目说明',rows:[['material_version','questionnaire_version','training_type','task_id','domain','scenario','ai_advice'],...questions]},{name:'变量说明',rows:[['字段','说明','编码'],...dictionary.map(f=>[f.field,f.label,f.coding])]}]);
   let offset=0;const stream=new ReadableStream({pull(c){if(offset>=bytes.length){c.close();return}c.enqueue(bytes.subarray(offset,offset+65536));offset+=65536}});return new Response(stream,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=experiment_data.xlsx','Cache-Control':'no-store'}});
  }
  const requestedPage=b.page===undefined?1:Number(b.page),pageSize=b.page_size===undefined?25:Number(b.page_size);if(!Number.isInteger(requestedPage)||requestedPage<1||![10,25,50,100].includes(pageSize))fail('分页参数无效');
  const count:any=await DB.prepare('SELECT count(*) AS n FROM participants p'+where).bind(...args).first();const totalPages=Math.max(1,Math.ceil(count.n/pageSize)),page=Math.min(requestedPage,totalPages);
  const records=await DB.prepare(`SELECT p.participant_id,p.study,p.training_domain,p.training_type,p.questionnaire_version,p.material_key,p.time_pressure,p.mode,p.group_id,p.recruitment_batch,p.started_at,p.completion_status,p.completed_at,(SELECT count(*) FROM responses r WHERE r.participant_id=p.participant_id) AS saved_tasks FROM participants p ${where} ORDER BY p.started_at DESC,p.rowid DESC LIMIT ? OFFSET ?`).bind(...args,pageSize,(page-1)*pageSize).all();
  for(const row of records.results as any[])row.participant_code=await codeFor(DB,row.participant_id);
  return json({rows:records.results,page,page_size:pageSize,total:count.n,total_pages:totalPages});
 }
 if(typeof b.participant_id!=='string'||typeof b.token!=='string')fail('缺少会话凭据',401);
 if(b.action==='answer'){if(typeof b.task_id!=='string')fail('题号无效');return await saveAnswerFast(DB,b)}
 const p:any=await DB.prepare('SELECT * FROM participants WHERE participant_id=? AND token_hash=?').bind(b.participant_id,await hash(b.token)).first();if(!p)fail('会话凭据无效',401);
 const snapshot=await packageFor(DB,p.material_version);const tasks=participantMaterial(snapshot,p).tasks;
 const answers:any=(await DB.prepare('SELECT * FROM responses WHERE participant_id=? ORDER BY task_position').bind(p.participant_id).all()).results;
 if(b.action==='resume')return json({participant:{...p,participant_code:await codeFor(DB,p.participant_id),token_hash:undefined},answers,materials:p.group_id&&snapshot.studies?snapshot.studies[p.study]:snapshot.materials,demographics:snapshot.demographics,aiVariables:snapshot.aiVariables||[],instructions:instructionsFor(snapshot,p.study)});
 if(b.action==='consent'){if(p.completion_status==='entry')await DB.prepare("UPDATE participants SET completion_status='training' WHERE participant_id=? AND completion_status='entry'").bind(p.participant_id).run();return json({ok:true})}
 if(b.action==='training'){
  if(p.completion_status==='entry')fail('请先阅读并同意参与说明');
  if(!validMs(b.duration_ms))fail('阅读时长无效');
  await DB.prepare("UPDATE participants SET training_duration_ms=COALESCE(training_duration_ms,?),completion_status=CASE WHEN completion_status='training' THEN 'tasks' ELSE completion_status END WHERE participant_id=?").bind(b.duration_ms,p.participant_id).run();return json({ok:true});
 }
 if(b.action==='begin'){
  const t=tasks[answers.length];if(!t||t.task_id!==b.task_id||p.completion_status!=='tasks')fail('题目顺序无效');
  await DB.prepare('INSERT OR IGNORE INTO task_starts (participant_id,task_id,started_ms) VALUES (?,?,?)').bind(p.participant_id,t.task_id,Date.now()).run();
  const start:any=await DB.prepare('SELECT started_ms FROM task_starts WHERE participant_id=? AND task_id=?').bind(p.participant_id,t.task_id).first();
  return json({started_ms:start.started_ms,remaining_ms:p.time_limit_ms===null?null:Math.max(0,p.time_limit_ms-(Date.now()-start.started_ms))});
 }
 if(b.action==='demographics'){
  if(answers.length!==tasks.length)fail('请先完成正式任务');
  const d=b.demographics;if(!d||typeof d!=='object')fail('个人信息无效');for(const field of snapshot.demographics){const value=d[field.id==='edu'?'education':field.id];if((field.required&&!value)||(value&&!field.options.includes(value)))fail('请正确填写'+field.label)}
  if(p.completion_status==='completed')return json({ok:true});
  await DB.prepare("UPDATE participants SET demographics=?,completion_status='quiz' WHERE participant_id=?").bind(JSON.stringify(d),p.participant_id).run();return json({ok:true});
 }
 if(b.action==='quiz'||b.action==='finish'){
  if(p.completion_status==='completed')return json({ok:true});
  if(answers.length!==tasks.length||p.demographics===null)fail('请先完成前面的部分');
  const quiz=participantMaterial(snapshot,p).quiz;
  if(!Array.isArray(b.quiz)||b.quiz.length!==quiz.length||b.quiz.some((value:any,i:number)=>!quiz[i].options.some((o:any)=>o.value===value)))fail('请完成全部知识测验');
  const ai=snapshot.aiVariables||[];
  if(b.action==='quiz'){
   await DB.prepare("UPDATE participants SET knowledge_quiz=?,completion_status='ai_variables' WHERE participant_id=?").bind(JSON.stringify(b.quiz),p.participant_id).run();return json({ok:true});
  }
  const values=b.ai_variables||{};
  if(typeof values!=='object'||ai.some((q:any)=>!Number.isInteger(values[q.id])||values[q.id]<1||values[q.id]>q.options.length))fail('请完成全部AI相关变量题目');
  const clean=Object.fromEntries(ai.map((q:any)=>[q.id,values[q.id]]));
  await DB.prepare("UPDATE participants SET knowledge_quiz=?,ai_variables=?,completed_at=?,completion_status='completed' WHERE participant_id=?").bind(JSON.stringify(b.quiz),JSON.stringify(clean),new Date().toISOString(),p.participant_id).run();
  const response=json({ok:true});response.headers.set('X-Backup-Trigger','experiment-completed');return response;
 }
 fail('操作无效');
 }catch(e:any){return json({error:e.status?e.message:'保存暂时失败，请重试'},e.status||500)}}

export async function POST(req:Request){try{return await withRequest(req,handle)}catch{return Response.json({error:"服务暂不可用，请重试"},{status:503,headers:{"Cache-Control":"no-store"}})}}
