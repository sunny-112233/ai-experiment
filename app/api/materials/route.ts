import {env} from 'cloudflare:workers';
import {BASE_VERSION,defaultPackage,draftState,packageFor,validatePackage,checkAdmin} from '../../../lib/material-versions';
import html from '../../../lib/experiment-html';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 const raw=await req.text();if(raw.length>1000000)return json({error:'材料过大'},413);const b=JSON.parse(raw);if(!await checkAdmin(env,b.admin_token))return json({error:'后台访问口令错误'},403);const DB=env.DB!;
 if(b.action==='load'){const state=await draftState(DB);const history=(await DB.prepare('SELECT version_id,published_at FROM material_versions ORDER BY published_at DESC').all()).results;return json({...state,history:[...history,{version_id:BASE_VERSION,published_at:null}]})}
 if(b.action==='version'){return json({package:await packageFor(DB,b.version)})}
 if(b.action==='save'){
 const draft=validatePackage(b.package);if(!Number.isInteger(b.revision)||b.revision<0)return json({error:'草稿修订号无效'},400);const now=new Date().toISOString();const payload=JSON.stringify(draft);const before=await draftState(DB);if(before.revision!==b.revision)return json({error:'草稿已被其他页面修改，请重新载入后编辑'},409);
 if(b.revision===0)await DB.prepare("INSERT OR IGNORE INTO material_state(id,draft,revision,active_version,published_revision,updated_at) VALUES ('main',?,1,?,0,?)").bind(payload,BASE_VERSION,now).run();else await DB.prepare("UPDATE material_state SET draft=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=?").bind(payload,now,b.revision).run();
 const after=await draftState(DB);if(after.revision!==b.revision+1||JSON.stringify(after.draft)!==payload)return json({error:'草稿保存冲突，请重新载入'},409);return json(after)}
 if(b.action==='publish'){
 const state=await draftState(DB);if(b.revision!==state.revision)return json({error:'草稿已更新，请重新载入'},409);if(!state.revision||state.revision===state.published_revision)return json({error:'没有尚未发布的草稿修改'},400);validatePackage(state.draft);const version='MAT-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,8),now=new Date().toISOString();
 await DB.batch([DB.prepare("INSERT INTO material_versions(version_id,payload,published_at) SELECT ?,draft,? FROM material_state WHERE id='main' AND revision=? AND (published_revision IS NULL OR published_revision<>revision)").bind(version,now,b.revision),DB.prepare("UPDATE material_state SET active_version=?,published_revision=revision WHERE id='main' AND revision=? AND EXISTS(SELECT 1 FROM material_versions WHERE version_id=?)").bind(version,b.revision,version)]);
 const latest=await draftState(DB);if(latest.active_version!==version)return json({error:'发布遇到版本冲突，请重新载入后检查'},409);const response=json({version,...latest});response.headers.set('X-Backup-Trigger','materials-published');return response}
 if(b.action==='preview'){
 const p=validatePackage(b.package);if(![1,2,3].includes(b.study)||!['A','B'].includes(b.version))return json({error:'预览条件无效'},400);
 const material=(b.study===2?'expert':'basic')+b.version;
 // A sandboxed, entirely local simulation. No participant session is created.
 let out=html;const a=out.search(/(?:const|let) DATA=/),end=out.indexOf('let S=',a);if(a<0||end<0)throw new Error('Preview template invalid');out=out.slice(0,a)+'let DATA='+JSON.stringify(p.materials).replace(/</g,'\\u003c')+';\n'+out.slice(end);
 const init=`\nconst PREVIEW_CONFIG=${JSON.stringify({study:b.study,version:b.version,material,stage:b.stage||'training',demographics:p.demographics}).replace(/</g,'\\u003c')};\n`+previewScript;
 out=out.replace('</script>',init+'</script>').replaceAll('云端测试版','主试预览 · 不保存作答');return json({html:out})}
 return json({error:'操作无效'},400)
 }catch(e:any){return json({error:e.status?e.message:'操作暂时失败，请重试'},e.status||500)}}
const previewScript=`
S.preview=true;S.pid='PREVIEW';S.code='主试预览';S.study=PREVIEW_CONFIG.study;S.version=PREVIEW_CONFIG.version;S.pressure=S.study===3?'high':'none';S.material=PREVIEW_CONFIG.material;S.tasks=DATA[S.material].tasks;S.answers=[];S.idx=0;
api=async function(action,payload={}){if(action==='begin')return {task_id:payload.task_id,remaining_ms:S.study===3?30000:null};if(action==='answer')return {ok:true,answer:{...payload},next:null};return {ok:true}};
start=async function(){loadTraining()};acceptConsent=async function(){loadTraining()};
showDone=function(){$('doneId').textContent='预览结束，未保存任何被试记录。';page('done')};
const originalSaveTask=saveTask;saveTask=async function(score,timeout){if(S.busy)return;S.busy=true;clearInterval(S.timerId);stopAdviceAnimation();S.answers.push({task_id:S.tasks[S.idx].task_id,adoption_score:score});S.idx=S.answers.length;S.busy=false;if(S.idx<38)await renderTask();else page('demographics')};
renderDemographics(PREVIEW_CONFIG.demographics);
if(PREVIEW_CONFIG.stage==='task'){renderTask()}else if(PREVIEW_CONFIG.stage==='quiz'){renderQuiz()}else if(PREVIEW_CONFIG.stage==='demographics'){page('demographics')}else loadTraining();
`;
