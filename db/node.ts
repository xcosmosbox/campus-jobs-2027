import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openSqliteBinding} from './sqlite-binding.mjs';
import type {DatabaseBinding,PlatformSettings} from './binding';

let binding:ReturnType<typeof openSqliteBinding>|undefined;
export function getBinding():DatabaseBinding {
 if(!binding)binding=openSqliteBinding(process.env.AUTUMN27_DATABASE_PATH||resolve('storage/workspace.sqlite'),{migrationDirectory:resolve('drizzle')});
 return binding as DatabaseBinding;
}
export function platformSettings():PlatformSettings {
 const publicOrigin=new URL(process.env.PUBLIC_ORIGIN||'http://localhost:3000').origin;
 const secureCookies=publicOrigin.startsWith('https:');
 return {loginProvider:'none',cookieName:secureCookies?'__Host-autumn27-session':'autumn27-selfhost-session',secureCookies,publicOrigin};
}
export function clientAddress(request:Request):string|null{return request.headers.get('x-autumn27-client-ip');}
export async function getCatalogAsset(path:string):Promise<Response>{
 if(!/^\/catalog\/[a-f0-9]{64}\/\d+\.json$/.test(path))return new Response(null,{status:404});
 try{return new Response(await readFile(resolve('dist/client',path.slice(1))),{headers:{'content-type':'application/json'}});}catch{return new Response(null,{status:503});}
}
