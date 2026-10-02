import {readWorkspace,saveRecord,secureWrite,respond,routeError} from '@/lib/workspace-server';
import {requireSpace} from '@/lib/guest-server';
export async function GET(request:Request){try{return respond(await readWorkspace(await requireSpace(request)));}catch(error){return routeError(error);}}
export async function POST(request:Request){try{secureWrite(request);const uid=await requireSpace(request);const body=await request.text();if(body.length>64000)return respond({error:'记录内容过长'},413);return respond(await saveRecord(uid,JSON.parse(body)));}catch(error){return routeError(error);}}
