import {env as bindings} from 'cloudflare:workers';
export const env:any=bindings;
export async function withRequest(req:Request,handle:(r:Request)=>Promise<Response>){return handle(req)}

export const maxBackupUploadBytes=100*1024*1024;
