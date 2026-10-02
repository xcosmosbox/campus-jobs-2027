import {bootstrap,sessionAction} from '@/lib/guest-server';
import {routeError,respond,secureWrite} from '@/lib/workspace-server';
import type {SessionAction} from '@/lib/session-types';
function response(result:{session:unknown;cookie:string|null;recoveryCode?:string}){const r=respond({session:result.session,...(result.recoveryCode?{recoveryCode:result.recoveryCode}:{})});if(result.cookie)r.headers.set('Set-Cookie',result.cookie);return r;}
export async function GET(request:Request){try{return response(await bootstrap(request));}catch(e){return routeError(e);}}
export async function POST(request:Request){try{secureWrite(request);const body=await request.text();if(body.length>4000)return respond({error:'输入内容过长'},413);const input=JSON.parse(body) as {action:SessionAction;code?:unknown};if(!['recover','recovery','new_guest','link_account','open_account'].includes(input?.action))return respond({error:'操作无效'},400);return response(await sessionAction(request,input.action,input.code));}catch(e){return routeError(e);}}
