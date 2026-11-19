export const RECRUITMENT_BATCH = 'formal-2026-11-v2';
export const GROUPS = [
 {id:'s1-basicA',study:1,material:'basicA',pressure:'none'},
 {id:'s1-basicB',study:1,material:'basicB',pressure:'none'},
 {id:'s2-basicA-none',study:2,material:'basicA',pressure:'none'},
 {id:'s2-basicB-none',study:2,material:'basicB',pressure:'none'},
 {id:'s2-basicA-high',study:2,material:'basicA',pressure:'high'},
 {id:'s2-basicB-high',study:2,material:'basicB',pressure:'high'},
 {id:'s3-basicA',study:3,material:'basicA',pressure:'none'},
 {id:'s3-basicB',study:3,material:'basicB',pressure:'none'},
 {id:'s3-expertA',study:3,material:'expertA',pressure:'none'},
 {id:'s3-expertB',study:3,material:'expertB',pressure:'none'},
];
export async function recruitmentState(DB:any){
 const saved=await DB.prepare("SELECT draft,revision FROM material_state WHERE id='recruitment'").first();
 const enabled=saved?JSON.parse(saved.draft).enabled:GROUPS.map(g=>g.id);
 const counts=(await DB.prepare('SELECT group_id,COUNT(*) AS allocated,SUM(CASE WHEN completion_status=\'completed\' THEN 1 ELSE 0 END) AS completed FROM participants WHERE recruitment_batch=? GROUP BY group_id').bind(RECRUITMENT_BATCH).all()).results;
 return {revision:saved?.revision||0,enabled,groups:GROUPS.map(g=>({...g,...counts.find((c:any)=>c.group_id===g.id),allocated:Number(counts.find((c:any)=>c.group_id===g.id)?.allocated||0),completed:Number(counts.find((c:any)=>c.group_id===g.id)?.completed||0)}))};
}
