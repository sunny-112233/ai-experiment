import {DEFAULT_INSTRUCTIONS} from './instructions';
import baseline from './materials.json';
export const BASE_VERSION='2026-11-03-v5';
export const defaultDemographics=[{id:'sex',label:'性别',required:true,options:['男','女','不愿透露']},{id:'age',label:'年龄段',required:true,options:['18岁以下','18~25','26~30','31~40','41~50','51~60','60以上']},{id:'edu',label:'学历',required:true,options:['初中及以下','高中/中专','大学专科','大学本科','研究生及以上']}];
export function defaultPackage(){return {materials:baseline,demographics:defaultDemographics}}
export function editablePackage(input:any){
 const p=structuredClone(input);
 p.studies ||= Object.fromEntries([1,2,3].map(study=>[study,structuredClone(p.materials)]));
 for(const set of Object.values(p.studies) as any[])for(const [key,m] of Object.entries(set) as any){m.quiz.forEach((q:any,i:number)=>q.id ||= key+'_QUIZ_'+(i+1));}
 p.aiVariables ||= [];
 p.instructions ||= {shared:{},studies:{}};

 return p;
}
export function participantMaterial(snapshot:any,p:any){return p.group_id&&snapshot.studies?snapshot.studies[p.study][p.material_key]:snapshot.materials[p.material_key]}
const publishedCache=new Map<string,any>();
export async function packageFor(DB:any,version:string){if(version===BASE_VERSION)return defaultPackage();if(publishedCache.has(version))return publishedCache.get(version);const r=await DB.prepare('SELECT payload FROM material_versions WHERE version_id=?').bind(version).first();if(!r)throw Object.assign(new Error('材料版本不存在，请联系主试'),{status:409});const snapshot=JSON.parse(r.payload);if(publishedCache.size>=8){const oldest=publishedCache.keys().next().value;if(oldest)publishedCache.delete(oldest)}publishedCache.set(version,snapshot);return snapshot}
export async function activePackage(DB:any){const s=await DB.prepare("SELECT active_version FROM material_state WHERE id='main'").first();const version=s?.active_version||BASE_VERSION;return {version,package:await packageFor(DB,version)}}
export async function draftState(DB:any){const s=await DB.prepare("SELECT * FROM material_state WHERE id='main'").first();return s?{draft:JSON.parse(s.draft),revision:s.revision,active_version:s.active_version||BASE_VERSION,published_revision:s.published_revision,updated_at:s.updated_at}:{draft:defaultPackage(),revision:0,active_version:BASE_VERSION,published_revision:0,updated_at:null}}
export function validatePackage(p:any){
 const fail=(m:string):never=>{throw Object.assign(new Error(m),{status:400})};
 const text=(s:any,max:number,label:string)=>{if(typeof s!=='string'||!s.trim()||s.length>max)fail(label+'不能为空且不能超长')};
 const options=(items:any,label:string)=>{if(!Array.isArray(items)||!items.length||items.length>30)fail(label+'选项数量无效');items.forEach((o:any)=>text(o,2000,label));if(new Set(items).size!==items.length)fail(label+'选项不能重复')};
 if(!p||typeof p!=='object'||!p.materials)fail('材料结构不完整');
 const sets=[p.materials,...(p.studies?Object.values(p.studies):[])];
 if(p.studies&&[1,2,3].some(i=>!p.studies[i]))fail('需保留三个研究的材料');
 for(const set of sets as any[]){for(const key of ['basicA','basicB','expertA','expertB']){
 const m=set[key];if(!m||!Array.isArray(m.training)||m.training.length>100)fail('培训段落数量无效');m.training.forEach((s:any)=>text(s,10000,'培训段落'));
 if(!Array.isArray(m.tasks)||m.tasks.length>200)fail('AI题目数量无效');
 const ids=new Set();m.tasks.forEach((t:any)=>{text(t.task_id,100,'题号');if(!/^[A-Za-z0-9_-]+$/.test(t.task_id)||ids.has(t.task_id))fail('题号重复或无效');ids.add(t.task_id);if(!['medical','outdoor'].includes(t.domain))fail('任务领域无效');if(!Number.isInteger(t.source_no)||t.source_no<1)fail('来源题号无效');text(t.scenario,10000,'题目情境');text(t.advice,10000,'AI建议');if(t.advice_correctness!==undefined&&![null,'correct','incorrect'].includes(t.advice_correctness))fail('正确性标签无效');if(t.primary_outcome!==undefined&&t.primary_outcome!==null&&typeof t.primary_outcome!=='boolean')fail('主要指标标签无效')});
 if(!Array.isArray(m.quiz)||m.quiz.length>100)fail('知识测验数量无效');m.quiz.forEach((q:any)=>{text(q.question,5000,'知识测验题干');if(!Array.isArray(q.options)||q.options.length<2||q.options.length>10)fail('知识测验需2至10个选项');const codes=new Set();q.options.forEach((o:any)=>{text(o.value,50,'选项编码');if(codes.has(o.value))fail('选项编码重复');codes.add(o.value);text(o.label,5000,'选项')})});
 }}
 if(!Array.isArray(p.demographics)||p.demographics.length>100)fail('个人信息数量无效');const fieldIds=new Set();p.demographics.forEach((d:any)=>{text(d.id,60,'字段编码');if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(d.id)||fieldIds.has(d.id)||['__proto__','constructor','prototype'].includes(d.id))fail('个人信息编码重复或无效');fieldIds.add(d.id);text(d.label,500,'个人信息标题');if(typeof d.required!=='boolean')fail('必答设置无效');options(d.options,'个人信息')});
 if(p.aiVariables!==undefined){if(!Array.isArray(p.aiVariables)||p.aiVariables.length>200)fail('AI变量题数无效');const ids=new Set();p.aiVariables.forEach((q:any)=>{text(q.id,60,'量表题号');if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(q.id)||ids.has(q.id))fail('量表题号重复或无效');ids.add(q.id);text(q.question,5000,'AI变量题干');options(q.options,'AI变量');if(q.options.length!==5)fail('AI相关变量每题必须保留五个评分选项');if(q.guide!==undefined&&(typeof q.guide!=='string'||q.guide.length>5000))fail('题目指导语无效')})}
 if(p.instructions!==undefined){const ins=p.instructions;if(!ins||typeof ins!=='object'||Array.isArray(ins))fail('指导语结构无效');const check=(obj:any)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj))fail('指导语结构无效');for(const [key,value] of Object.entries(obj)){if(!Object.hasOwn(DEFAULT_INSTRUCTIONS,key)||typeof value!=='string'||value.length>15000)fail('指导语字段无效或超长')}};if(ins.shared!==undefined)check(ins.shared);if(ins.studies!==undefined){if(!ins.studies||typeof ins.studies!=='object'||Array.isArray(ins.studies))fail('研究指导语结构无效');for(const [study,obj] of Object.entries(ins.studies)){if(!['1','2','3'].includes(study))fail('指导语研究无效');check(obj)}}}
 return p;
}
export async function checkAdmin(env:any,token:any){if(typeof token!=='string'||!env.ADMIN_TOKEN)return false;const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const a=await digest(token),b=await digest(env.ADMIN_TOKEN);return a.every((v,i)=>v===b[i])}
