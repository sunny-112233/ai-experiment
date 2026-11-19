import {waitUntil} from '@vercel/functions';
import {getDatabase} from './postgres';
import {getStore,getSecondaryStore} from './storage';
import {createBackup} from '../backups';
export const env:any={get DB(){return getDatabase()},get BUCKET(){return getStore()},get SECONDARY_BUCKET(){return getSecondaryStore()},get ADMIN_TOKEN(){return process.env.ADMIN_TOKEN}};
let schemaReady=false;
export async function withRequest(req:Request,handle:(r:Request)=>Promise<Response>){
 if(!schemaReady){await env.DB.ensurePlatformSchema();schemaReady=true;}
 let response:Response;const path=new URL(req.url).pathname;
 // PG uses concurrent connections; serialize allocation and each participant's
 // read-modify-write workflow with transaction-scoped advisory locks.
 if(path==='/api/experiment'){
  const raw=await req.clone().text();if(raw.length>131072)return Response.json({error:'请求过大'},{status:413});let b:any;try{b=JSON.parse(raw)}catch{return Response.json({error:'请求格式错误'},{status:400})}
  const adminMutation=b.action==='admin'&&b.delete_participant_ids!==undefined;
  if(b.action==='admin'&&!adminMutation)response=await handle(req);else response=await env.DB.atomic(['create','recruitment-save','recruitment-load'].includes(b.action)||adminMutation?'experiment-allocation':'participant:'+String(b.participant_id),()=>handle(req));
 }else if(path==='/api/materials')response=await env.DB.atomic('material-publication',()=>handle(req));else response=await handle(req);
 const trigger=response.headers.get('X-Backup-Trigger');if(response.ok&&trigger){waitUntil(createBackup(env,trigger,false).catch(()=>console.error('Automatic backup failed; check backup history.')))}return response;
}

export const maxBackupUploadBytes=4*1024*1024;
