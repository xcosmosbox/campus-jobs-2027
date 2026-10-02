import {history,respond,routeError} from '@/lib/workspace-server';
import {requireSpace} from '@/lib/guest-server';
export async function GET(request:Request){try{return respond(await history(await requireSpace(request),new URL(request.url).searchParams.get('cursor')));}catch(error){return routeError(error);}}
