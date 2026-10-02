import {getBinding,platformSettings} from '@/db';
import type {DatabaseBinding} from '@/db/binding';
import {opportunities} from './screening';
import {hasCatalogPosition,originalCatalogPosition} from './catalog-server';
import {positionAliases,legacyPositions,blankPersonal,fieldLabels,type Workspace,type Event,type Kind,type Change} from './workspace';
import {InputError,validateEnvelope,validatePersonal,validatePosition,validateTask,validateReview} from './workspace-validation';

export class RouteError extends Error{constructor(message:string,public status:number,public details:Record<string,unknown>={}){super(message);}}
export function secureWrite(request:Request){const origin=request.headers.get('origin'),expected=platformSettings().publicOrigin||new URL(request.url).origin;if(request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==expected)throw new RouteError('请从本站保存记录',403);if(!request.headers.get('content-type')?.includes('application/json'))throw new RouteError('请求格式无效',415);}
export function respond(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export function routeError(error:unknown){if(error instanceof RouteError)return respond({error:error.message,...error.details},error.status);if(error instanceof InputError)return respond({error:error.message},400);if(error instanceof SyntaxError)return respond({error:'请求内容格式无效'},400);
 console.error('Workspace request failed',error instanceof Error?error.message:'unknown');return respond({error:'暂时无法读取或保存记录，请稍后重试。你的输入仍保留在页面中。'},503);}
type RecordRow={kind:Kind;item_id:string;payload:string;revision:number;updated_at:string};
type EventRow={id:string;kind:Kind;item_id:string;summary:string;changes:string;source_url:string|null;created_at:string};
function event(row:EventRow):Event{return {id:row.id,kind:row.kind,itemId:row.item_id,summary:row.summary,changes:JSON.parse(row.changes),sourceUrl:row.source_url,createdAt:row.created_at};}
export async function history(uid:string,cursor:string|null=null){
 const db=getBinding();let rows;
 if(cursor){const split=cursor.indexOf('|');if(split<0)throw new InputError('历史记录位置无效');const time=cursor.slice(0,split),id=cursor.slice(split+1);
  rows=await db.prepare('SELECT * FROM workspace_events WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 201').bind(uid,time,time,id).all<EventRow>();
 }else rows=await db.prepare('SELECT * FROM workspace_events WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 201').bind(uid).all<EventRow>();
 const page=rows.results.slice(0,200),last=page.at(-1);return {events:page.map(event),historyCursor:rows.results.length>200&&last?`${last.created_at}|${last.id}`:null};
}
export async function readWorkspace(uid:string):Promise<Workspace>{const db=getBinding();const [rows,h]=await Promise.all([
 db.prepare('SELECT kind,item_id,payload,revision,updated_at FROM workspace_records WHERE user_id=?').bind(uid).all<RecordRow>(),history(uid)]);
 const w:Workspace={personal:{},tasks:[],positions:[],reviews:{},...h};
 for(const row of rows.results){const saved={id:row.item_id,data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at};
  if(row.kind==='personal')w.personal[row.item_id]=saved;else if(row.kind==='review')w.reviews[row.item_id]=saved;else if(row.kind==='position')w.positions.push(saved);else if(row.kind==='task')w.tasks.push(saved);}
 return w;
}
async function existingItem(db:DatabaseBinding,uid:string,id:string){return opportunities.some(r=>r.id===id)||hasCatalogPosition(id)||hasCatalogPosition(positionAliases[id])||legacyPositions.some(p=>p.id===id)||!!await db.prepare('SELECT item_id FROM workspace_records WHERE user_id=? AND kind=? AND item_id=?').bind(uid,'position',id).first();}
export async function saveRecord(uid:string,input:unknown){
 const {kind,id,revision,data:raw,mutationId,origin}=validateEnvelope(input),db=getBinding();
 const requestHash=mutationId?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({kind,id,revision,data:raw,origin})))),n=>n.toString(16).padStart(2,'0')).join(''):'';
 const replay=async()=>{if(!mutationId)return null;const row=await db.prepare('SELECT request_hash,result FROM workspace_mutations WHERE user_id=? AND mutation_id=?').bind(uid,mutationId).first<{request_hash:string;result:string}>();if(!row)return null;if(row.request_hash!==requestHash)throw new RouteError('同一次保存请求的内容发生变化，请重新保存',409);return JSON.parse(row.result);};
 const prior=await replay();if(prior)return prior;
 if(kind==='review'&&!opportunities.some(r=>r.id===id))throw new InputError('招聘记录不存在');
 if(kind==='personal'&&!await existingItem(db,uid,id))throw new InputError('公司或岗位不存在');
 const data=kind==='personal'?validatePersonal(raw):kind==='task'?validateTask(raw,id):kind==='position'?validatePosition(raw,id,origin!=='manual'):validateReview(raw,origin!=='manual');
 if(kind==='task'&&'itemId'in data&&data.itemId&&!await existingItem(db,uid,data.itemId))throw new InputError('关联机会不存在');
 const previous=await db.prepare('SELECT payload,revision FROM workspace_records WHERE user_id=? AND kind=? AND item_id=?').bind(uid,kind,id).first<{payload:string;revision:number}>();
 if((previous?.revision||0)!==revision)throw new RouteError('此记录已在其他设备更新，请选择保留哪份内容',409,{conflict:true});
 if(!previous){const count=await db.prepare('SELECT COUNT(*) AS n FROM workspace_records WHERE user_id=?').bind(uid).first<{n:number}>();if(count&&count.n>=1500)throw new RouteError('当前空间记录过多，请更新已有记录或先下载备份',413);}
 const original=opportunities.find(r=>r.id===id);
 const before=previous?JSON.parse(previous.payload):kind==='review'?{...original,sourceUrl:original?.sources[0]||'',entryUrl:original?.entries[0]||'',applicationEmail:original?.applicationEmail||'',applicationMethod:original?.applicationMethod||''}:kind==='position'?await originalCatalogPosition(id)||legacyPositions.find(p=>p.id===id):kind==='personal'?blankPersonal:{};
 const changes:Change[]=Object.entries(data).filter(([key,value])=>!['id','opportunityId','checkedAt','completedAt'].includes(key)&&JSON.stringify(before?.[key]??null)!==JSON.stringify(value)).map(([field,after])=>({field,before:before?.[field]??null,after}));
 const now=new Date().toISOString(),eid=crypto.randomUUID(),next=revision+1;
 const sourceUrl='sourceUrl'in data?data.sourceUrl:null;
 const labels=changes.slice(0,4).map(c=>fieldLabels[c.field]||c.field).join('、');
 const summary=(origin==='backup'?'导入备份 · ':origin==='local'?'同步本机记录 · ':'')+(kind==='review'?`复核招聘信息${labels?'：'+labels:'：信息未变'}`:kind==='position'?`${previous?'更新':'补录'}岗位${labels?'：'+labels:''}`:kind==='task'?`${previous?'更新':'添加'}待办${labels?'：'+labels:''}`:`${previous?'更新':'加入'}投递跟进${labels?'：'+labels:''}`);
 const write=db.prepare('INSERT INTO workspace_records (user_id,kind,item_id,payload,revision,updated_at,last_event_id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,kind,item_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at,last_event_id=excluded.last_event_id WHERE workspace_records.revision=?').bind(uid,kind,id,JSON.stringify(data),next,now,eid,revision);
 const log=db.prepare('INSERT INTO workspace_events (id,user_id,kind,item_id,summary,changes,source_url,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspace_records WHERE user_id=? AND kind=? AND item_id=? AND last_event_id=?)').bind(eid,uid,kind,id,summary,JSON.stringify(changes),sourceUrl,now,uid,kind,id,eid);
 const output={kind,saved:{id,data,revision:next,updatedAt:now},event:{id:eid,kind,itemId:id,summary,changes,sourceUrl,createdAt:now}};
 const statements=[write,log];if(mutationId)statements.push(db.prepare('INSERT INTO workspace_mutations (user_id,mutation_id,request_hash,result,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspace_records WHERE user_id=? AND kind=? AND item_id=? AND last_event_id=?)').bind(uid,mutationId,requestHash,JSON.stringify(output),now,uid,kind,id,eid));
 const result=await db.batch(statements);if(!result[0].meta.changes){const duplicate=await replay();if(duplicate)return duplicate;throw new RouteError('记录刚刚发生变化，请选择保留哪份内容',409,{conflict:true});}
 return output;
}
