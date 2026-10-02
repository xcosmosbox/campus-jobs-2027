import seedAliases from '@/data/position-aliases.json';
import seedLegacyPositions from '@/data/legacy-positions.json';
import {opportunities,defaults,filterOpportunities,statusOf,daysLeft,type Opportunity,type Filters} from './screening';

export const stages={pending:'待投递',applied:'已投递',assessment:'测评',written:'笔试',interview:'面试',offer:'Offer',ended:'已结束'} as const;
export const priorities={high:'优先投递',normal:'正常考虑',low:'低优先级'} as const;
export const directions=['AI / Agent','算法','研发 / 信息科技','产品 / 策略','投研 / 金融','管培 / 综合','运营 / 营销','其他'];
export const reasons={access:'页面无法读取',secondary:'只有二手信息',internship:'仅有实习项目',body:'只有标题／缺少正文',scope:'主体或批次不清',no_current:'未找到当届信息',other:'其他证据不足'} as const;
export type Stage=keyof typeof stages;
export type Priority=keyof typeof priorities;
export type Reason=keyof typeof reasons;
export type Personal={stage:Stage;submittedAt:string|null;resumeVersion:string;interviewRound:number;endedReason:string;priority:Priority;favorite:boolean;hidden:boolean;notes:string};
export const blankPersonal:Personal={stage:'pending',submittedAt:null,resumeVersion:'',interviewRound:0,endedReason:'',priority:'normal',favorite:false,hidden:false,notes:''};
export type Position={id:string;opportunityId:string;name:string;department:string;employmentType?:keyof typeof employmentLabels;locations:string[];direction:string;education:'unknown'|'college'|'bachelor'|'master'|'phd';majors:string;graduationStart:string|null;graduationEnd:string|null;graduationText:string;overseas:'unknown'|'accepted'|'conditional'|'no';qualificationNote:string;sourceUrl:string;evidence:string;verified:boolean;verification?:'official'|'employer';checkedAt:string|null;entryUrl:string;startDate:string|null;endDate:string|null;endTime:string|null;deadlineLabel:string;campaignStatus:'open'|'closed'|'upcoming'|'unknown';deadlineScope:string};
export type Task={id:string;itemId:string;title:string;kind:'application'|'assessment'|'written'|'interview'|'other';dueAt:string;notes:string;completed:boolean;completedAt:string|null};
export type Review={confirmed:boolean;verification:'official'|'employer'|'unconfirmed';sourceUrl:string;evidence:string;scopeLabel:string;startDate:string|null;startTime:string|null;endDate:string|null;endTime:string|null;deadlineLabel:string;campaignStatus:'open'|'closed'|'upcoming'|'unknown';entryUrl:string;applicationEmail:string;applicationMethod:string;note:string;reviewReason:string;reasonCategory:Reason;checkedAt:string};
export type Kind='personal'|'task'|'position'|'review';
export type Saved<T>={id:string;data:T;revision:number;updatedAt:string};
export type Change={field:string;before:unknown;after:unknown};
export type Event={id:string;kind:Kind;itemId:string;summary:string;changes:Change[];sourceUrl:string|null;createdAt:string};
export type Workspace={personal:Record<string,Saved<Personal>>;tasks:Saved<Task>[];positions:Saved<Position>[];reviews:Record<string,Saved<Review>>;events:Event[];historyCursor:string|null};
export const emptyWorkspace:Workspace={personal:{},tasks:[],positions:[],reviews:{},events:[],historyCursor:null};
export const positionAliases:Record<string,string>=seedAliases;
export const legacyPositions=seedLegacyPositions as Position[];
export const employmentLabels={graduate:'正式校招',conversion:'实习转正项目',internship:'当届实习项目',unknown:'岗位性质未确认'} as const;
export const educationLabels={unknown:'学历未确认',college:'大专及以上',bachelor:'本科及以上',master:'硕士及以上',phd:'博士'};
export const overseasLabels={unknown:'海外资格未确认',accepted:'接受海外毕业生',conditional:'接受，附加要求见说明',no:'明确不接受海外学历'};
export const taskKinds={application:'投递',assessment:'测评',written:'笔试',interview:'面试',other:'其他'};

export function reasonOf(r:Opportunity):Reason{
 const assigned=(r as Opportunity&{reasonCategory?:Reason}).reasonCategory;
 if(assigned&&Object.hasOwn(reasons,assigned))return assigned;
 const text=[r.reviewReason,r.evidence,r.note].join(' ');
 if(/仅.*实习|只有.*实习|实习项目|转正实习|暑期实习/.test(text))return 'internship';
 if(/仅.*标题|只有.*标题|缺少正文|正文未取得|未读.*正文/.test(text))return 'body';
 if(/二手|媒体|第三方|转载|非原始/.test(text))return 'secondary';
 if(/无法|超时|脚本|重定向|不可读|读取失败|未成功|未返回/.test(text))return 'access';
 if(/范围不清|主体不清|主体.*未.*确认|分公司.*混/.test(text))return 'scope';
 if(/未找到|未取得.*当届|旧年度|2026届|非本届/.test(text))return 'no_current';
 return 'other';
}
export function dateConfirmation(r:Opportunity){
 if(!r.confirmed)return {key:'unknown',label:'日期未确认'};
 if(r.startDate&&r.endDate)return {key:'full',label:'起止日期已确认'};
 if(r.endDate)return {key:'partial',label:'截止日期已确认'};
 if(r.startDate)return {key:'partial',label:'起日已确认／截止未确认'};
 return {key:'unknown',label:/滚动|全年|长期|招满|无统一/.test(r.deadlineLabel||'')?'无统一精确日期':'起止日期未确认'};
}
export function mergeOpportunities(w:Workspace):Opportunity[]{
 return opportunities.map(r=>{
  const saved=w.reviews[r.id];if(!saved)return r;const v=saved.data;
  return {...r,...v,reasonCategory:v.reasonCategory,entries:v.entryUrl?[v.entryUrl]:[],sources:[v.sourceUrl,...r.sources.filter(s=>s!==v.sourceUrl)],
   evidence:v.evidence,reviewStatus:v.confirmed?'confirmed':'unconfirmed',applicationEmail:v.applicationEmail||null,
   audit:{attemptedAt:v.checkedAt,attempts:[{url:v.sourceUrl,query:null,outcome:v.evidence||v.reviewReason,ref:null},...(r.audit?.attempts||[])],supportingRefs:r.audit?.supportingRefs||[]}} as Opportunity;
 });
}
export function mergedPositions(w:Workspace,seeds:Position[]=[]):Position[]{
 const retired=new Set([...legacyPositions.map(p=>p.id),...Object.keys(positionAliases)]);
 const map=new Map(seeds.filter(p=>!retired.has(p.id)).map(p=>[p.id,p]));for(const row of w.positions)if(!retired.has(row.id))map.set(row.id,row.data);return [...map.values()];
}
export function positionOpportunity(p:Position,parent:Opportunity):Opportunity{
 return {...parent,id:p.id,scopeLabel:[p.department,p.name].filter(Boolean).join(' · '),confirmed:p.verified,verification:p.verified?(p.verification||'official'):'unconfirmed',checkedAt:p.checkedAt||parent.checkedAt,
  reviewStatus:p.verified?'confirmed':'unconfirmed',reviewReason:p.verified?'只确认本岗位来源明确支持的信息。':'本岗位信息未完成来源核验。',
  startDate:p.startDate,startTime:null,endDate:p.endDate,endTime:p.endTime,campaignStatus:p.campaignStatus,deadlineLabel:p.deadlineLabel,
  entries:p.entryUrl?[p.entryUrl]:[],sources:p.sourceUrl?[p.sourceUrl]:[],applicationEmail:null,applicationMethod:null,entryLabel:'岗位入口',originalPeriod:undefined,audit:undefined,independentReview:undefined,
  evidence:p.evidence,note:p.deadlineScope||'岗位起止未确认，不继承集团统一期限。'};
}
export type Item={id:string;label:string;parent:Opportunity;record:Opportunity;position?:Position;personal:Personal;tracked:boolean;legacy?:boolean};
export function allItems(records:Opportunity[],ps:Position[],w:Workspace):Item[]{
 const map=new Map(records.map(r=>[r.id,r]));
 const existingIds=new Set(ps.map(p=>p.id)),byId=new Map(ps.map(p=>[p.id,p]));
 const savedPositions=new Map(w.positions.map(row=>[row.id,row.data]));
 const hasSaved=(id:string)=>!!w.personal[id]||w.tasks.some(t=>t.data.itemId===id)||savedPositions.has(id);
 const legacy=[...Object.entries(positionAliases).flatMap(([id,target])=>{const p=savedPositions.get(id)||byId.get(target);return p&&!existingIds.has(id)&&hasSaved(id)?[{...p,id,name:p.name+'（原跟进条目已合并）'}]:[];}),...legacyPositions.filter(p=>!existingIds.has(p.id)&&hasSaved(p.id)).map(p=>{const saved=savedPositions.get(p.id)||p;return {...saved,name:saved.name+'（原岗位概览跟进）'};})];
 return [...records.map(r=>({id:r.id,label:r.company,parent:r,record:r,personal:w.personal[r.id]?.data||blankPersonal,tracked:!!w.personal[r.id]})),
 ...[...ps,...legacy].flatMap(p=>{const parent=map.get(p.opportunityId);return parent?[{id:p.id,label:p.name,parent,record:positionOpportunity(p,parent),position:p,personal:w.personal[p.id]?.data||blankPersonal,tracked:!!w.personal[p.id],...(!existingIds.has(p.id)?{legacy:true}:{})}]:[];})];
}
export type WorkspaceFilters=Filters&{mode:'company'|'position';stage:string;priority:string;favoriteOnly:boolean;visibility:'visible'|'hidden'|'all';source:string;datePrecision:string;reason:string;role:string;city:string;employment:string;direction:string;education:string;graduation:string;overseas:string};
export const workspaceDefaults:WorkspaceFilters={...defaults,mode:'company',stage:'all',priority:'all',favoriteOnly:false,visibility:'visible',source:'all',datePrecision:'all',reason:'all',role:'',city:'',employment:'all',direction:'all',education:'all',graduation:'',overseas:'all'};
export function hasPositionFilters(f:WorkspaceFilters){return !!(f.role.trim()||f.city.trim()||f.employment!=='all'||f.direction!=='all'||f.education!=='all'||f.graduation||f.overseas!=='all');}
export function withoutPositionFilters(f:WorkspaceFilters):WorkspaceFilters{return {...f,role:'',city:'',employment:'all',direction:'all',education:'all',graduation:'',overseas:'all'};}
function searchWords(text:string){return text.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);}
export function matchesPosition(p:Position,f:WorkspaceFilters){
 const title=`${p.name} ${p.department}`.normalize('NFKC').toLocaleLowerCase();
 if(!searchWords(f.role).every(word=>title.includes(word)))return false;
 const cityKeyword=f.city.trim();if(cityKeyword&&!p.locations.some(city=>city.includes(cityKeyword)))return false;
 if(f.employment!=='all'&&(p.employmentType||'unknown')!==f.employment)return false;
 if(f.direction!=='all'&&p.direction!==f.direction)return false;
 if(f.education!=='all'){
  if(f.education==='unknown'){if(p.education!=='unknown')return false;}
  else {const rank={college:0,bachelor:1,master:2,phd:3,unknown:99};if(!p.verified||rank[p.education]>rank[f.education as keyof typeof rank])return false;}
 }
 if(f.graduation&&(!p.verified||!p.graduationStart||!p.graduationEnd||f.graduation<p.graduationStart||f.graduation>p.graduationEnd))return false;
 if(f.overseas!=='all'&&(f.overseas==='accepted'?!p.verified||!['accepted','conditional'].includes(p.overseas):p.overseas!==f.overseas))return false;
 return true;
}
function matchesConfirmation(r:Opportunity,f:WorkspaceFilters){
 if(f.source==='confirmed'&&!r.confirmed||f.source==='unconfirmed'&&r.confirmed)return false;
 if(f.datePrecision!=='all'&&dateConfirmation(r).key!==f.datePrecision)return false;
 if(f.reason!=='all'&&(r.confirmed||reasonOf(r)!==f.reason))return false;
 return true;
}
export function matchingPositions(records:Opportunity[],ps:Position[],f:WorkspaceFilters,today:string,now:Date){
 const parents=new Map(records.map(r=>[r.id,r]));
 const candidates=ps.filter(p=>parents.has(p.opportunityId)&&matchesPosition(p,f));
 const projected=candidates.map(p=>({...positionOpportunity(p,parents.get(p.opportunityId)!),company:parents.get(p.opportunityId)!.company}));
 const byId=new Map(candidates.map(p=>[p.id,p]));
 return filterOpportunities(projected,f,today,now).filter(r=>matchesConfirmation(r,f)).map(r=>byId.get(r.id)!);
}
export function filterItems(items:Item[],ps:Position[],f:WorkspaceFilters,today:string,now:Date,trackedOnly=false){
 const candidates=items.filter(i=>trackedOnly?i.tracked:!i.legacy&&(f.mode==='company'?!i.position:!!i.position));
 const qualification=hasPositionFilters(f);
 const grouping=qualification&&f.mode==='company'&&!trackedOnly;
 const batchFilters=grouping?{...f,status:'all',deadline:'all',cutoff:'',verifiedOnly:false}:f;
 const ids=new Set(filterOpportunities(candidates.map(i=>({...i.record,company:i.parent.company})),batchFilters,today,now).map(r=>r.id));
 const matching=qualification?matchingPositions([...new Map(items.map(i=>[i.parent.id,i.parent])).values()],ps,f,today,now):[];
 const matchingIds=new Set(matching.map(p=>p.id)),matchingCompanies=new Set(matching.map(p=>p.opportunityId));
 for(const [id,target] of Object.entries(positionAliases))if(matchingIds.has(target))matchingIds.add(id);
 const result=candidates.filter(i=>{
  if(trackedOnly?!i.tracked:(f.mode==='company'?!!i.position:!i.position))return false;
  if(!ids.has(i.id))return false;
  if(f.visibility==='visible'&&i.personal.hidden||f.visibility==='hidden'&&!i.personal.hidden)return false;
  if(f.favoriteOnly&&!i.personal.favorite)return false;
  if(f.stage!=='all'&&i.personal.stage!==f.stage)return false;
  if(f.priority!=='all'&&i.personal.priority!==f.priority)return false;
  if(!grouping&&!matchesConfirmation(i.record,f))return false;
  if(qualification&&!(i.position?matchingIds.has(i.id)||(trackedOnly&&i.legacy&&matchesPosition(i.position,f)):matchingCompanies.has(i.id)))return false;
  return true;
 });
 const groupedOrder=new Map<string,number>();for(const p of matching)if(!groupedOrder.has(p.opportunityId))groupedOrder.set(p.opportunityId,groupedOrder.size);
 const ordered=grouping?groupedOrder:new Map(filterOpportunities(result.map(i=>({...i.record,company:i.parent.company})),{...f,sort:f.sort==='priority'?'deadline':f.sort},today,now).map((r,n)=>[r.id,n]));
 return result.sort((a,b)=>{
  if(f.sort==='priority'){const rank={high:0,normal:1,low:2};const d=rank[a.personal.priority]-rank[b.personal.priority]||Number(b.personal.favorite)-Number(a.personal.favorite);if(d)return d;}
  return (ordered.get(a.id)||0)-(ordered.get(b.id)||0);
 });
}
export type Todo={id:string;title:string;kind:string;itemId:string;dueAt:string|null;dueDate:string;notes:string;completed:boolean;automatic:boolean};
export function todos(items:Item[],w:Workspace,today:string,now:Date):Todo[]{
 const auto=items.filter(i=>i.personal.favorite&&!i.personal.hidden&&i.personal.stage==='pending'&&statusOf(i.record,today,now)==='open'&&i.record.endDate)
  .map(i=>({id:'auto:'+i.id,title:`投递 ${i.parent.company}${i.position?' · '+i.label:''}`,kind:'application',itemId:i.id,dueDate:i.record.endDate!,
   dueAt:i.record.endTime?`${i.record.endDate}T${i.record.endTime==='24:00'?'23:59:59':i.record.endTime}+08:00`:null,notes:i.record.scopeLabel||'',completed:false,automatic:true}));
 return [...auto,...w.tasks.map(s=>({...s.data,dueDate:s.data.dueAt.slice(0,10),automatic:false}))].sort((a,b)=>Number(a.completed)-Number(b.completed)||a.dueDate.localeCompare(b.dueDate)||(a.dueAt||'').localeCompare(b.dueAt||''));
}
export function reviewScore(r:Opportunity,today:string,now:Date){const left=daysLeft(r,today);const age=Math.max(0,Math.round((Date.parse(today)-Date.parse(r.checkedAt))/86400000));return (!r.confirmed?100:0)+(left!==null&&left>=0&&left<=7&&statusOf(r,today,now)==='open'?150:0)+Math.min(age,30);}
export function prettyTime(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
export function localTime(value:string){const d=new Date(value);return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(' ','T');}
export const fieldLabels:Record<string,string>={stage:'投递进度',submittedAt:'投递时间',resumeVersion:'简历版本',interviewRound:'面试轮次',endedReason:'结束原因',priority:'个人优先级',favorite:'收藏',hidden:'暂不考虑',notes:'备注',confirmed:'来源确认',verification:'来源类型',sourceUrl:'来源网址',evidence:'核验依据',scopeLabel:'主体／批次',startDate:'开始日期',startTime:'开始时刻',endDate:'截止日期',endTime:'截止时刻',deadlineLabel:'期限说明',campaignStatus:'招聘开放状态',entryUrl:'投递入口',applicationEmail:'投递邮箱',applicationMethod:'投递方式',note:'核验说明',reviewReason:'未确认原因',reasonCategory:'原因分类',checkedAt:'核验日期',name:'岗位名称',department:'部门',locations:'工作地点',employmentType:'岗位性质',direction:'岗位方向',education:'学历',majors:'专业',graduationStart:'毕业窗口开始',graduationEnd:'毕业窗口结束',graduationText:'毕业要求',overseas:'海外学历要求',qualificationNote:'资格说明',verified:'岗位来源确认',title:'待办事项',kind:'待办类型',dueAt:'待办期限',completed:'待办完成',completedAt:'完成时间',deadlineScope:'期限适用范围'};
