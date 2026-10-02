import {emptyWorkspace,type Workspace,type Kind,type Event,type Saved} from './workspace';
import {freshCache,newId,project,savedFor,withSaved,mergeCloud,validated,parseBackup,sameData,type Cache,type Pending,type Mutation} from './workspace-cache';
import type {CacheStorage} from './browser-storage';
import type {SessionInfo,SessionAction} from './session-types';

export class ApiError extends Error{constructor(message:string,public status:number,public body:Record<string,unknown>={}){super(message);}}
export type SaveResult={kind:Kind;saved:Saved<unknown>;event:Event};
export interface Transport{session():Promise<SessionInfo>;read(scope:string):Promise<Workspace>;save(scope:string,op:Mutation):Promise<SaveResult>;action(action:SessionAction,code?:string):Promise<{session:SessionInfo;recoveryCode?:string}>;history(scope:string,cursor:string):Promise<{events:Event[];historyCursor:string|null}>;}
export type ClientState={data:Workspace;session:SessionInfo|null;ready:boolean;loading:boolean;saving:boolean;syncing:boolean;online:boolean;localAvailable:boolean;error:string;notice:string;pending:Pending[];lastSaved:string};
export class WorkspaceClient{
 cache:Cache|null=null;state:ClientState={data:emptyWorkspace,session:null,ready:false,loading:true,saving:false,syncing:false,online:true,localAvailable:true,error:'',notice:'',pending:[],lastSaved:''};
 private changes:Promise<unknown>=Promise.resolve();private syncPromise:Promise<void>|null=null;private active=true;
 constructor(private storage:CacheStorage,private transport:Transport,private emit:(state:ClientState)=>void){}
 private publish(extra:Partial<ClientState>={}){if(!this.active)return;this.state={...this.state,...extra,...(this.cache?{data:project(this.cache),session:this.cache.session,pending:this.cache.pending,ready:true}:{})};this.emit(this.state);}
 private edit<T>(fn:()=>Promise<T>):Promise<T>{const next=this.changes.then(fn,fn);this.changes=next.catch(()=>{});return next;}
 private async persist(){if(!this.cache)return;this.cache.updatedAt=new Date().toISOString();try{this.cache=await this.storage.put(this.cache);this.state.localAvailable=true;}catch{this.state.localAvailable=false;this.publish({notice:'本地副本保存失败。云端可用时仍可保存；断网时请保留输入并重试。'});}this.publish();}
 async init(){try{this.cache=await this.storage.last();if(this.cache)this.publish({loading:true});}catch{this.state.localAvailable=false;}await this.refresh();}
 stop(){this.active=false;}
 async refresh(){if(this.syncPromise)await this.syncPromise;this.publish({loading:true,error:''});try{
  const session=await this.transport.session();await this.edit(async()=>{if(!this.cache||this.cache.scope!==session.scope){const prior=this.cache;let stored:Cache|null=null;try{stored=await this.storage.get(session.scope);}catch{}this.cache=stored||freshCache(session.scope,session);
    if(prior?.scope.startsWith('local:')){this.cache.pending=prior.pending;this.cache.settled=prior.settled;}else if(prior)this.state.notice='已切换空间。原空间的本地副本仍保留，可在保存与账号中下载备份。';
   }this.cache.session=session;await this.persist();});
  const scope=this.cache!.scope,cloud=await this.transport.read(scope);await this.edit(async()=>{if(this.cache?.scope===scope){this.cache.cloud=mergeCloud(this.cache.cloud,cloud);await this.persist();}});this.publish({online:true,error:''});
 }catch(e){if(!this.cache){this.cache=freshCache('local:'+newId());await this.persist();}this.publish({online:false,error:e instanceof Error?e.message:'暂时无法连接云端'});}finally{this.publish({loading:false});}if(this.state.online)void this.sync();}
 async save(kind:Kind,id:string,input:unknown){const result=await this.edit(async()=>{if(!this.cache)throw new Error('记录尚未读取');if(this.cache.pending.some(op=>op.kind===kind&&op.id===id&&op.status!=='queued'))throw new Error('此记录有待处理的同步差异，请先在保存与账号中选择保留哪份');
  const data=validated(kind,id,input,'local'),revision=savedFor(project(this.cache),kind,id)?.revision||0,op:Pending={kind,id,data,revision,mutationId:newId(),origin:'local',createdAt:new Date().toISOString(),status:'queued'};
  this.publish({saving:true,error:''});this.cache.pending.push(op);await this.persist();this.publish({saving:false,lastSaved:op.createdAt});return op;});
 if(!this.state.localAvailable&&!this.state.online)throw new Error('本地保存不可用且无法连接云端，请保留输入后重试');if(!this.state.localAvailable){await this.sync();if(this.cache?.pending.some(op=>op.mutationId===result.mutationId))throw new Error('尚未保存成功，请保留输入后重试');}else void this.sync();return result;
 }
 sync():Promise<void>{if(this.syncPromise)return this.syncPromise;this.syncPromise=this.runSync().finally(()=>{this.syncPromise=null;this.publish({syncing:false});});return this.syncPromise;}
 private async runSync(){if(!this.cache||this.cache.scope.startsWith('local:'))return;this.publish({syncing:true});const scope=this.cache.scope,blocked=new Set(this.cache.pending.filter(p=>p.status!=='queued').map(p=>p.kind+':'+p.id));
  while(this.cache?.scope===scope){const op=this.cache.pending.find(p=>p.status==='queued'&&!blocked.has(p.kind+':'+p.id));if(!op)break;
   try{const result=await this.transport.save(scope,{kind:op.kind,id:op.id,revision:op.revision,data:op.data,mutationId:op.mutationId,origin:op.origin});await this.edit(async()=>{if(this.cache?.scope!==scope)return;if((savedFor(this.cache.cloud,result.kind,result.saved.id)?.revision||0)<=result.saved.revision)this.cache.cloud=withSaved(this.cache.cloud,result.kind,result.saved);this.cache.cloud={...this.cache.cloud,events:[result.event,...this.cache.cloud.events.filter(e=>e.id!==result.event.id)]};this.cache.settled.push(op.mutationId);this.cache.pending=this.cache.pending.filter(p=>p.mutationId!==op.mutationId);await this.persist();});this.publish({online:true,error:''});
   }catch(e){if(e instanceof ApiError&&e.status===409&&e.body.conflict){let cloud:Workspace;try{cloud=await this.transport.read(scope);}catch{this.publish({online:false,error:'无法读取冲突记录，修改已留在本机，请重新同步'});break;}await this.edit(async()=>{if(this.cache?.scope!==scope)return;this.cache.cloud=mergeCloud(this.cache.cloud,cloud);for(const p of this.cache.pending)if(p.kind===op.kind&&p.id===op.id){p.status='conflict';p.error=e.message;}await this.persist();});blocked.add(op.kind+':'+op.id);continue;}
    if(e instanceof ApiError&&e.status>=400&&e.status<500&&![401,409,429].includes(e.status)){await this.edit(async()=>{if(this.cache?.scope!==scope)return;const p=this.cache.pending.find(p=>p.mutationId===op.mutationId);if(p){p.status='blocked';p.error=e.message;}await this.persist();});blocked.add(op.kind+':'+op.id);continue;}
    this.publish({online:false,error:e instanceof Error?e.message:'修改已保存在本机，等待联网同步'});break;
   }
  }
 }
 async resolve(kind:Kind,id:string,choice:'local'|'cloud'){await this.edit(async()=>{if(!this.cache)return;const ops=this.cache.pending.filter(p=>p.kind===kind&&p.id===id);if(!ops.length)return;const last=ops.at(-1)!;this.cache.settled.push(...ops.map(p=>p.mutationId));this.cache.pending=this.cache.pending.filter(p=>p.kind!==kind||p.id!==id);if(choice==='local')this.cache.pending.push({...last,mutationId:newId(),revision:savedFor(this.cache.cloud,kind,id)?.revision||0,status:'queued',error:undefined,createdAt:new Date().toISOString()});await this.persist();});void this.sync();}
 async action(action:SessionAction,code?:string){if(this.syncPromise)await this.syncPromise;if(this.cache?.pending.length&&action!=='recover')throw new Error('请先同步或处理未同步记录，再切换空间、生成恢复码或关联账号');const result=await this.transport.action(action,code);await this.refresh();return result;}
 async importBackup(input:unknown){const rows=parseBackup(input);await this.edit(async()=>{if(!this.cache)throw new Error('请先读取记录');if(this.cache.pending.length)throw new Error('请先同步或处理现有修改，再导入备份');const original=project(this.cache);for(const row of rows){const prior=savedFor(original,row.kind,row.id);if(prior&&sameData(prior.data,row.data))continue;this.cache.pending.push({...row,revision:prior?.revision||0,mutationId:newId(),origin:'backup',createdAt:new Date().toISOString(),status:prior?'conflict':'queued',...(prior?{error:'备份与当前记录不同，请选择保留哪份'}:{})});}await this.persist();});void this.sync();return rows.length;}
 backup(cache=this.cache){if(!cache)throw new Error('暂无可导出的记录');return {format:'autumn27-workspace',version:1,exportedAt:new Date().toISOString(),workspace:structuredClone(project(cache))};}
 async localCopies(){return this.storage.list();}
 conflictRows(){if(!this.cache)return [];const problems=new Map<string,Pending>();for(const op of this.cache.pending)if(op.status!=='queued')problems.set(op.kind+':'+op.id,op);return [...problems].map(([key,problem])=>{const last=this.cache!.pending.filter(p=>p.kind+':'+p.id===key).at(-1)!;return {op:{...last,status:problem.status,error:problem.error},cloud:savedFor(this.cache!.cloud,last.kind,last.id)};});}
 async moreHistory(){const cache=this.cache;if(!cache?.cloud.historyCursor||!cache.session)return;try{const h=await this.transport.history(cache.scope,cache.cloud.historyCursor);await this.edit(async()=>{if(this.cache?.scope!==cache.scope)return;this.cache.cloud=mergeCloud(this.cache.cloud,{...this.cache.cloud,...h});await this.persist();});}catch(e){this.publish({error:e instanceof Error?e.message:'读取失败'});}}
}
