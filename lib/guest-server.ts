import {getBinding,platformSettings,clientAddress} from '@/db';
import {RouteError} from './workspace-server';
import type {SessionInfo,SessionAction} from './session-types';

type Space={id:string;recovery_hash:string|null;generation:number};
const lifetime=365*86400;
export const cookieName=()=>platformSettings().cookieName;
export function signedIn(request:Request){if(platformSettings().loginProvider!=='chatgpt')return null;const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return id&&email?{id,email}:null;}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
function cookie(token:string){return `${cookieName()}=${token}; Path=/; Max-Age=${lifetime}; HttpOnly; SameSite=Lax${platformSettings().secureCookies?'; Secure':''}`;}
function cookieToken(request:Request){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName()+'='))?.slice(cookieName().length+1);}
async function lookupSession(request:Request){const token=cookieToken(request);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 return getBinding().prepare('SELECT p.id,p.recovery_hash,p.generation,s.token_hash FROM workspace_sessions s JOIN workspace_spaces p ON p.id=s.space_id AND p.generation=s.generation WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Math.floor(Date.now()/1000)).first<Space&{token_hash:string}>();
}
export async function requireSpace(request:Request){const space=await lookupSession(request);if(!space)throw new RouteError('访问凭证已失效，请重新读取记录或使用恢复码',401);const expected=request.headers.get('x-workspace-scope');if(expected&&expected!==await digest('scope:'+space.id))throw new RouteError('当前空间已切换，请重新读取后操作。原本机记录仍保留。',409,{scopeChanged:true});return space.id;}
async function ensureSpace(id:string){const db=getBinding();await db.prepare('INSERT INTO workspace_spaces (id,created_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(id,new Date().toISOString()).run();return (await db.prepare('SELECT id,recovery_hash,generation FROM workspace_spaces WHERE id=?').bind(id).first<Space>())!;}
async function accountSpace(id:string){const db=getBinding();const link=await db.prepare('SELECT space_id FROM workspace_accounts WHERE account_id=?').bind(id).first<{space_id:string}>();if(link)return link.space_id;
 const legacy=await db.prepare('SELECT item_id FROM workspace_records WHERE user_id=? LIMIT 1').bind(id).first();return legacy?id:null;
}
async function info(space:Space,request:Request):Promise<SessionInfo>{const account=signedIn(request);const linked=account?await accountSpace(account.id):null;
 const loginProvider=platformSettings().loginProvider;
 return {scope:await digest('scope:'+space.id),mode:linked===space.id?'account':'guest',hasRecovery:!!space.recovery_hash,account:account?{email:account.email,connected:linked===space.id,hasWorkspace:!!linked}:null,loginProvider,signInPath:loginProvider==='chatgpt'?'/signin-with-chatgpt?return_to=%2F':null,signOutPath:loginProvider==='chatgpt'?'/signout-with-chatgpt?return_to=%2F':null};
}
async function issue(space:Space,request:Request){const token=secret();await getBinding().prepare('INSERT INTO workspace_sessions (token_hash,space_id,generation,expires_at) VALUES (?,?,?,?)').bind(await digest(token),space.id,space.generation,Math.floor(Date.now()/1000)+lifetime).run();return {session:await info(space,request),cookie:cookie(token)};}
async function rate(request:Request,action:string,limit:number){const ip=clientAddress(request);if(!ip)return;const hour=Math.floor(Date.now()/3600000),db=getBinding(),bucket=await digest(`${action}:${ip}:${hour}`);
 const row=await db.prepare('INSERT INTO workspace_rates (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,(hour+2)*3600).first<{count:number}>();
 if(row&&row.count>limit)throw new RouteError('操作过于频繁，请稍后重试',429);
 await db.prepare('DELETE FROM workspace_rates WHERE expires_at<?').bind(Math.floor(Date.now()/1000)).run();
}
export async function bootstrap(request:Request){if(request.headers.get('sec-fetch-site')==='cross-site')throw new RouteError('请从本站读取保存状态',403);
 const existing=await lookupSession(request);if(existing)return {session:await info(existing,request),cookie:null};
 const account=signedIn(request),known=account?await accountSpace(account.id):null;
 if(known)return issue(await ensureSpace(known),request);
 await rate(request,'new',20);return issue(await ensureSpace('guest:'+crypto.randomUUID()),request);
}
export async function sessionAction(request:Request,action:SessionAction,code?:unknown){const db=getBinding();
 if(action==='recover'){
  await rate(request,'recover',30);if(typeof code!=='string'||!/^A27-[a-f0-9]{64}$/.test(code.trim()))throw new RouteError('恢复码无效或已更换，请检查完整内容',400);
  const space=await db.prepare('SELECT id,recovery_hash,generation FROM workspace_spaces WHERE recovery_hash=?').bind(await digest(code.trim())).first<Space>();
  if(!space)throw new RouteError('恢复码无效或已更换，请检查完整内容',400);return issue(space,request);
 }
 const current=await lookupSession(request);if(!current)throw new RouteError('请先重新读取记录',401);
 if(action==='new_guest'){await rate(request,'new',20);return issue(await ensureSpace('guest:'+crypto.randomUUID()),request);}
 if(action==='recovery'){
  const recovery='A27-'+secret(),hash=await digest(recovery),generation=current.generation+1;
  const result=await db.batch([
   db.prepare('UPDATE workspace_spaces SET recovery_hash=?,generation=? WHERE id=? AND generation=?').bind(hash,generation,current.id,current.generation),
   db.prepare('UPDATE workspace_sessions SET generation=?,expires_at=? WHERE token_hash=? AND space_id=? AND generation=? AND EXISTS (SELECT 1 FROM workspace_spaces WHERE id=? AND generation=? AND recovery_hash=?)').bind(generation,Math.floor(Date.now()/1000)+lifetime,current.token_hash,current.id,current.generation,current.id,generation,hash),
  ]);if(!result[0].meta.changes)throw new RouteError('恢复码刚被更新，请重新读取后操作',409);
  // Preserve this device's token so a lost rotation response cannot lock it out.
  return {session:await info({...current,recovery_hash:hash,generation},request),cookie:cookie(cookieToken(request)!),recoveryCode:recovery};
 }
 if(platformSettings().loginProvider==='none')throw new RouteError('此部署未配置账号登录，请使用游客空间、恢复码或备份',400);
 const account=signedIn(request);if(!account)throw new RouteError('请先使用 ChatGPT 登录，再关联或打开账号空间',401);
 const known=await accountSpace(account.id);
 if(action==='open_account'){const space=await ensureSpace(known||account.id);await db.prepare('INSERT INTO workspace_accounts (account_id,space_id,created_at) VALUES (?,?,?) ON CONFLICT(account_id) DO NOTHING').bind(account.id,space.id,new Date().toISOString()).run();return issue(space,request);}
 if(action==='link_account'){
  if(known&&known!==current.id)throw new RouteError('账号已有记录。请先下载当前备份，再打开账号空间；需要合并时可导入备份并逐项处理差异。',409);
  const other=await db.prepare('SELECT account_id FROM workspace_accounts WHERE space_id=?').bind(current.id).first<{account_id:string}>();if(other&&other.account_id!==account.id)throw new RouteError('此空间已关联其他账号，不能更改关联。可以继续使用恢复码访问。',409);
  try{await db.prepare('INSERT INTO workspace_accounts (account_id,space_id,created_at) VALUES (?,?,?) ON CONFLICT(account_id) DO NOTHING').bind(account.id,current.id,new Date().toISOString()).run();}catch{throw new RouteError('账号关联发生变化，请重新读取后再试',409);}
  const linked=await accountSpace(account.id);if(linked!==current.id)throw new RouteError('账号已有其他空间，请打开账号空间后导入备份',409);
  return {session:await info(current,request),cookie:null};
 }
 throw new RouteError('操作无效',400);
}
