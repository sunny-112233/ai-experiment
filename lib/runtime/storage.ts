import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
export class PrivateObjectStore{
 client:S3Client;bucket:string;
 constructor(prefix='BACKUP_S3_'){
  const get=(k:string)=>process.env[prefix+k];this.bucket=get('BUCKET')||'';if(get('ENDPOINT')){const endpoint=new URL(get('ENDPOINT')!);if(endpoint.protocol!=='https:'&&!(['127.0.0.1','localhost'].includes(endpoint.hostname)&&process.env.NODE_ENV!=='production'))throw Error('S3 endpoint must use HTTPS')}
  if(!this.bucket||!get('ACCESS_KEY_ID')||!get('SECRET_ACCESS_KEY'))throw Object.assign(new Error('备份存储尚未配置'),{status:503});
  this.client=new S3Client({region:get('REGION')||'us-east-1',...(get('ENDPOINT')?{endpoint:get('ENDPOINT')}:{}),forcePathStyle:get('FORCE_PATH_STYLE')==='true',credentials:{accessKeyId:get('ACCESS_KEY_ID')!,secretAccessKey:get('SECRET_ACCESS_KEY')!}})
 }
 async put(key:string,bytes:Uint8Array,options:any={}){await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:bytes,ContentType:options.httpMetadata?.contentType||'application/zip',Metadata:options.customMetadata,ServerSideEncryption:process.env.BACKUP_S3_ENCRYPTION==='AES256'?'AES256':undefined,IfNoneMatch:'*'}))}
 async get(key:string){try{const r=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}));return r.Body?{body:r.Body.transformToWebStream()}:null}catch(e:any){if(e.$metadata?.httpStatusCode===404)return null;throw e}}
}
let primary:PrivateObjectStore|undefined,secondary:PrivateObjectStore|undefined;
export function getStore(){if(!process.env.BACKUP_S3_BUCKET)return undefined;return primary??=new PrivateObjectStore()}
export function getSecondaryStore(){if(!process.env.SECONDARY_S3_BUCKET)return undefined;return secondary??=new PrivateObjectStore('SECONDARY_S3_')}
