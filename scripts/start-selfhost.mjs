import {resolve} from 'node:path';
import {startProdServer} from 'vinext/server/prod-server';
import {openSqliteBinding} from '../db/sqlite-binding.mjs';

process.env.NODE_ENV||='production';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be an integer from 0 to 65535');
const origin=new URL(process.env.PUBLIC_ORIGIN||`http://localhost:${port}`);
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin');
process.env.PUBLIC_ORIGIN=origin.origin;
// Apply the same immutable migrations before accepting the first request.
const initial=openSqliteBinding(process.env.AUTUMN27_DATABASE_PATH||resolve('storage/workspace.sqlite'));
initial.close();
const {server,port:actualPort}=await startProdServer({port,host,outDir:resolve('dist')});
// Node has no Sites dispatcher. Ignore incoming identity/proxy capability
// headers, and supply only the socket address for guest rate limiting.
const handlers=server.listeners('request');server.removeAllListeners('request');
server.on('request',(request,response)=>{
 for(const name of Object.keys(request.headers))if(name.startsWith('oai-authenticated-')||name==='cf-connecting-ip'||name==='x-autumn27-client-ip')delete request.headers[name];
 request.headers['x-autumn27-client-ip']=request.socket.remoteAddress||'unknown';
 for(const handler of handlers)handler.call(server,request,response);
});
console.log(JSON.stringify({event:'autumn27-ready',port:actualPort,storage:'sqlite',login:'guest-recovery'}));
function stop(){server.close(()=>process.exit(0));server.closeIdleConnections();}
process.once('SIGTERM',stop);process.once('SIGINT',stop);
