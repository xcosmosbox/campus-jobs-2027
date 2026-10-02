import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Module} from 'node:module';
import ts from 'typescript';
import {openSqliteBinding} from '../db/sqlite-binding.mjs';
import {readCatalog} from './catalog-source.mjs';

const temporary=mkdtempSync(resolve(tmpdir(),'autumn27-selfhost-')),children=new Set();
const loaded=new Map();
function domain(name){
 if(loaded.has(name))return loaded.get(name);
 const filename=resolve('lib',name+'.cjs'),mod=new Module(filename);mod.filename=filename;
 const native=mod.require.bind(mod);mod.require=path=>path.startsWith('./')?domain(path.slice(2)):path.startsWith('@/data/')?native(resolve('data',path.slice(7))):native(path);
 mod._compile(ts.transpileModule(readFileSync(resolve('lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 loaded.set(name,mod.exports);return mod.exports;
}
const workspace=domain('workspace'),cache=domain('workspace-cache'),{WorkspaceClient,ApiError}=domain('workspace-client');
const catalog=readCatalog(),company=domain('screening').opportunities[0];
async function launch(name,filename){
 const origin=`http://${name}.example.test`;
 const child=spawn(process.execPath,['scripts/start-selfhost.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',AUTUMN27_TARGET:'sqlite',PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:origin,AUTUMN27_DATABASE_PATH:filename},stdio:['ignore','pipe','pipe']});
 children.add(child);let errors='',output='';child.stderr.on('data',b=>{errors=(errors+b).slice(-12000);});
 const port=await new Promise((resolvePort,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Self-host startup timed out: '+errors)),20000);
  child.once('exit',code=>{clearTimeout(timer);reject(new Error('Self-host exited before startup: '+code+' '+errors));});
  child.stdout.on('data',b=>{output+=b;for(const line of output.split('\n')){try{const event=JSON.parse(line);if(event.event==='autumn27-ready'){clearTimeout(timer);resolvePort(event.port);return;}}catch{}}});
 });
 return {child,origin,base:`http://127.0.0.1:${port}`,filename};
}
async function stop(instance){
 const child=instance.child;
 if(child.exitCode!==null||child.signalCode!==null){children.delete(child);return;}
 const done=once(child,'exit'),timer=setTimeout(()=>child.kill('SIGKILL'),5000);
 child.kill('SIGTERM');
 try{await done;}finally{clearTimeout(timer);children.delete(child);}
}
class Storage{spaces=new Map();active=null;async last(){return this.active?this.get(this.active):null;}async get(id){return structuredClone(this.spaces.get(id)||null);}async list(){return structuredClone([...this.spaces.values()]);}async put(value){const next=cache.mergeCaches(this.spaces.get(value.scope)||null,value);this.spaces.set(value.scope,structuredClone(next));this.active=value.scope;return structuredClone(next);}}
function browser(instance){return {instance,cookie:'',online:true,async api(path,{method='GET',data,scope,headers={}}={}){
 if(!this.online)throw new Error('offline');
 const response=await fetch(this.instance.base+path,{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(scope?{'x-workspace-scope':scope}:{}),...(data?{'content-type':'application/json',origin:this.instance.origin}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
 const next=response.headers.get('set-cookie');if(next)this.cookie=next.split(';')[0];
 const body=await response.json();if(!response.ok)throw new ApiError(body.error||'HTTP error',response.status,body);return {body,response};
 }};}
function transport(b){return {session:async()=>(await b.api('/api/session')).body.session,read:async scope=>(await b.api('/api/workspace',{scope})).body,save:async(scope,op)=>(await b.api('/api/workspace',{method:'POST',data:op,scope})).body,action:async(action,code)=>(await b.api('/api/session',{method:'POST',data:{action,...(code?{code}:{})}})).body,history:async(scope,cursor)=>(await b.api('/api/history'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{scope})).body};}
let a,b,c1,c2,c3;
try{
 const transaction=openSqliteBinding(resolve(temporary,'rollback.sqlite'));
 await transaction.prepare('INSERT INTO workspace_spaces (id,created_at) VALUES (?,?)').bind('existing','test').run();
 await assert.rejects(()=>transaction.batch([transaction.prepare('INSERT INTO workspace_spaces (id,created_at) VALUES (?,?)').bind('rollback','test'),transaction.prepare('INSERT INTO workspace_spaces (id,created_at) VALUES (?,?)').bind('existing','test')]));
 assert.equal(await transaction.prepare('SELECT id FROM workspace_spaces WHERE id=?').bind('rollback').first(),null,'a failed batch is fully rolled back');transaction.close();
 const results=await Promise.all([launch('instance-a',resolve(temporary,'a/workspace.sqlite')),launch('instance-b',resolve(temporary,'b/workspace.sqlite'))]);[a,b]=results;
 const html=await fetch(a.base+'/').then(r=>r.text());assert(html.includes('27届秋招'),'the production site renders its actual page');
 const ba=browser(a),bb=browser(b),storage=new Storage();
 const spoof=await ba.api('/api/session',{headers:{'oai-authenticated-user-id':'spoofed','oai-authenticated-user-email':'spoof@example.test'}});
 assert.equal(spoof.body.session.account,null);assert.equal(spoof.body.session.loginProvider,'none');assert.equal(spoof.body.session.signInPath,null);
 assert.match(spoof.response.headers.get('set-cookie'),/HttpOnly/);assert(!spoof.response.headers.get('set-cookie').includes('Secure'),'localhost HTTP cookies work');
 c1=new WorkspaceClient(storage,transport(ba),()=>{});c2=new WorkspaceClient(new Storage(),transport(bb),()=>{});await c1.init();await c2.init();
 const recovery=(await c1.action('recovery')).recoveryCode;
 await c1.save('personal',company.id,{...workspace.blankPersonal,notes:'实例 A 的个人记录',favorite:true});await c1.sync();assert.equal(c1.state.pending.length,0);
 assert.equal(c2.state.data.personal[company.id],undefined);
 await assert.rejects(()=>c2.action('recover',recovery),e=>e.status===400,'recovery codes cannot access another instance');
 await assert.rejects(()=>ba.api('/api/workspace',{method:'POST',data:{kind:'personal',id:company.id,revision:1,data:workspace.blankPersonal},scope:c1.state.session.scope,headers:{origin:'https://foreign.example'}}),e=>e.status===403);
 await assert.rejects(()=>c1.action('link_account'),e=>e.status===400);
 await stop(a);a=await launch('instance-a',a.filename);ba.instance=a;
 await c1.refresh();assert.equal(c1.state.data.personal[company.id].data.notes,'实例 A 的个人记录','SQLite data survives a complete server restart');
 const recoveredBrowser=browser(a);c3=new WorkspaceClient(new Storage(),transport(recoveredBrowser),()=>{});await c3.init();await c3.action('recover',recovery);assert.equal(c3.state.data.personal[company.id].data.notes,'实例 A 的个人记录');
 ba.online=false;await c1.save('personal',company.id,{...c1.state.data.personal[company.id].data,notes:'断网修改后恢复同步'});await c1.sync();c1.stop();
 c1=new WorkspaceClient(storage,transport(ba),()=>{});await c1.init();assert.equal(c1.state.data.personal[company.id].data.notes,'断网修改后恢复同步');ba.online=true;await c1.refresh();await c1.sync();assert.equal(c1.state.pending.length,0);
 const original=catalog[0];await c1.save('position',original.id,{...original,name:original.name+' · 自托管备注',acknowledged:true});await c1.sync();assert.equal(c1.state.pending.length,0);
 const history=(await ba.api('/api/history',{scope:c1.state.session.scope})).body.events;
 assert(history.some(e=>e.itemId===original.id&&e.changes.some(change=>change.field==='name'&&change.before===original.name)),'node static assets preserve the original job in edit history');
 await c2.save('personal',company.id,{...workspace.blankPersonal,notes:'实例 B 的原记录'});await c2.sync();
 const backup=c1.backup();assert(!JSON.stringify(backup).includes(recovery));assert(!JSON.stringify(backup).includes(ba.cookie.split('=')[1]));
 await c2.importBackup(backup);await c2.sync();assert.equal(c2.conflictRows().length,1,'cross-instance import retains both conflicting records');assert.equal(c2.conflictRows()[0].cloud.data.notes,'实例 B 的原记录');
 await c2.resolve('personal',company.id,'local');await c2.sync();assert.equal(c2.state.data.personal[company.id].data.notes,'断网修改后恢复同步');
 await c1.refresh();assert.equal(c1.state.data.personal[company.id].data.notes,'断网修改后恢复同步','importing into B never changes A');
 console.log('检查通过：实际 Node HTTP 页面与 API、SQLite 自动迁移／事务／重启持久化、忽略伪造身份、同源保存、跨实例隔离、恢复码、离线队列、岗位原始历史和备份冲突导入。');
}finally{
 c1?.stop();c2?.stop();c3?.stop();
 for(const child of children)await stop({child});
 rmSync(temporary,{recursive:true,force:true});
}
