import {opportunities,shanghaiDate} from './screening';
import {stages,priorities,reasons,directions,employmentLabels,type Personal,type Position,type Task,type Review,type Kind,localTime} from './workspace';

export class InputError extends Error {}
const fail=(message:string):never=>{throw new InputError(message);};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return fail('请输入有效的记录');return value as Record<string,unknown>;}
function text(o:Record<string,unknown>,key:string,max=5000,required=false){const value=o[key];if(typeof value!=='string')return fail(`${key} 格式错误`);const v=value.trim();if(v.length>max)return fail('输入内容过长');if(required&&!v)return fail('请填写必填内容');return v;}
function bool(o:Record<string,unknown>,key:string){if(typeof o[key]!=='boolean')return fail('请选择有效状态');return o[key] as boolean;}
function choice<T extends string>(o:Record<string,unknown>,key:string,values:readonly T[]):T{if(typeof o[key]!=='string'||!values.includes(o[key] as T))return fail('选择项无效');return o[key] as T;}
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function date(o:Record<string,unknown>,key:string){const value=o[key];if(value===null||value==='')return null;if(typeof value!=='string'||!validDate(value))return fail('日期无效，请使用完整年月日');return value;}
function instant(o:Record<string,unknown>,key:string,required=false){const value=o[key];if(!required&&(value===null||value===''))return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!validDate(value.slice(0,10))||Number.isNaN(Date.parse(value)))return fail('请填写有效的北京时间');return value;}
function url(o:Record<string,unknown>,key:string,required=false){const value=text(o,key,2000,required);if(!value)return '';try{const parsed=new URL(value);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||/[\s<>]/.test(value))return fail('请使用有效的网页网址');}catch{return fail('请使用有效的网页网址');}return value;}
function times(o:Record<string,unknown>,key:string,allow24=false){const value=o[key];if(value===null||value==='')return null;if(typeof value!=='string'||!(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)||allow24&&value==='24:00'))return fail('时刻无效');return value;}
function range(start:string|null,end:string|null){if(start&&end&&start>end)fail('截止／结束日期不能早于开始日期');}

export function validatePersonal(value:unknown):Personal{
 const o=object(value);const interviewRound=o.interviewRound;
 if(typeof interviewRound!=='number'||!Number.isInteger(interviewRound)||interviewRound<0||interviewRound>30)fail('面试轮次必须为0至30的整数');
 const stage=choice(o,'stage',Object.keys(stages) as (keyof typeof stages)[]);
 let submittedAt=instant(o,'submittedAt');
 if(stage==='applied'&&!submittedAt)submittedAt=new Date().toISOString();
 return {stage,submittedAt,resumeVersion:text(o,'resumeVersion',120),interviewRound:interviewRound as number,endedReason:text(o,'endedReason',500),
  priority:choice(o,'priority',Object.keys(priorities) as (keyof typeof priorities)[]),favorite:bool(o,'favorite'),hidden:bool(o,'hidden'),notes:text(o,'notes')};
}
function checkedDate(o:Record<string,unknown>,preserve:boolean){if(!preserve)return shanghaiDate();const value=o.checkedAt;if(typeof value!=='string'||!validDate(value)||value>shanghaiDate())fail('核验日期无效，不能把备份或离线同步视为新的查证');return value as string;}
export function validatePosition(value:unknown,id:string,preserve=false):Position{
 const o=object(value);const opportunityId=text(o,'opportunityId',100,true);
 if(!opportunities.some(r=>r.id===opportunityId))fail('关联公司不存在');
 if(!Array.isArray(o.locations)||o.locations.length>300||o.locations.some(v=>typeof v!=='string'||v.length>500))fail('地点格式无效');
 const verified=bool(o,'verified');if(verified&&o.acknowledged!==true)fail('请确认已阅读来源并核对岗位信息');
 const sourceUrl=url(o,'sourceUrl',verified),evidence=text(o,'evidence',3000,verified);
 let startDate=date(o,'startDate'),endDate=date(o,'endDate'),endTime=times(o,'endTime',true);
 const deadlineLabel=text(o,'deadlineLabel',1000);if(endDate&&/暂定|预计|不同.*截止|分别.*截止/.test(deadlineLabel))fail('暂定或分机构期限请只填写期限说明，不填写统一精确截止');
 range(startDate,endDate);if(endTime&&!endDate)fail('填写截止时刻前请先填写截止日期');
 const graduationStart=date(o,'graduationStart'),graduationEnd=date(o,'graduationEnd');range(graduationStart,graduationEnd);
 let campaignStatus=choice(o,'campaignStatus',['open','closed','upcoming','unknown'] as const);
 if(!verified){startDate=null;endDate=null;endTime=null;campaignStatus='unknown';}
 return {id,opportunityId,name:text(o,'name',180,true),department:text(o,'department',180),locations:[...new Set((o.locations as string[]).map(s=>s.trim()).filter(Boolean))],
  ...(o.employmentType!==undefined?{employmentType:choice(o,'employmentType',Object.keys(employmentLabels) as (keyof typeof employmentLabels)[])}:{}),direction:choice(o,'direction',directions),education:choice(o,'education',['unknown','college','bachelor','master','phd'] as const),majors:text(o,'majors',1000),graduationStart,graduationEnd,
  graduationText:text(o,'graduationText',1000),overseas:choice(o,'overseas',['unknown','accepted','conditional','no'] as const),qualificationNote:text(o,'qualificationNote',2000),sourceUrl,evidence,verified,
  verification:choice(o,'verification',['official','employer'] as const),checkedAt:verified?checkedDate(o,preserve):null,entryUrl:url(o,'entryUrl'),startDate,endDate,endTime,deadlineLabel,campaignStatus,deadlineScope:text(o,'deadlineScope',1000)};
}
export function validateTask(value:unknown,id:string):Task{
 const o=object(value),completed=bool(o,'completed');const due=instant(o,'dueAt',true)!;
 return {id,itemId:text(o,'itemId',180),title:text(o,'title',240,true),kind:choice(o,'kind',['application','assessment','written','interview','other'] as const),
  dueAt:localTime(due)+':00+08:00',notes:text(o,'notes',3000),completed,completedAt:completed?instant(o,'completedAt')||new Date().toISOString():null};
}
export function validateReview(value:unknown,preserve=false):Review{
 const o=object(value);if(o.acknowledged!==true)fail('请确认已实际查证并核对所填信息');
 const confirmed=bool(o,'confirmed'),sourceUrl=url(o,'sourceUrl',true),evidence=text(o,'evidence',3000,true),reviewReason=text(o,'reviewReason',3000,!confirmed);
 let startDate=date(o,'startDate'),endDate=date(o,'endDate'),startTime=times(o,'startTime'),endTime=times(o,'endTime',true);range(startDate,endDate);
 if(startTime&&!startDate||endTime&&!endDate)fail('填写时刻前请先填写相应日期');
 const deadlineLabel=text(o,'deadlineLabel',1000);if(endDate&&/暂定|预计|不同.*截止|分别.*截止/.test(deadlineLabel))fail('暂定或分机构期限请只填写期限说明，不填写统一精确截止');
 let campaignStatus=choice(o,'campaignStatus',['open','closed','upcoming','unknown'] as const),verification=choice(o,'verification',['official','employer','unconfirmed'] as const);
 if(!confirmed){startDate=null;endDate=null;startTime=null;endTime=null;campaignStatus='unknown';verification='unconfirmed';}
 else if(verification==='unconfirmed')fail('已确认来源请选择官方页面或雇主简章');
 const applicationEmail=text(o,'applicationEmail',200);if(applicationEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationEmail))fail('投递邮箱格式无效');
 return {confirmed,verification,sourceUrl,evidence,scopeLabel:text(o,'scopeLabel',300),startDate,startTime,endDate,endTime,deadlineLabel,campaignStatus,
  entryUrl:url(o,'entryUrl'),applicationEmail,applicationMethod:text(o,'applicationMethod',1000),note:text(o,'note',3000),reviewReason,
  reasonCategory:choice(o,'reasonCategory',Object.keys(reasons) as (keyof typeof reasons)[]),checkedAt:checkedDate(o,preserve)};
}
export function validateEnvelope(value:unknown){const o=object(value);const kind=choice(o,'kind',['personal','task','position','review'] as const);const id=text(o,'id',180,true);
 if(!/^[\p{L}\p{N}:._-]+$/u.test(id))fail('记录标识无效');if(!Number.isInteger(o.revision)||Number(o.revision)<0)fail('记录版本无效');
 if(kind==='position'&&!id.startsWith('role:')||kind==='task'&&!id.startsWith('task:'))fail('记录标识与类型不匹配');
 const mutationId=o.mutationId===undefined?null:text(o,'mutationId',100,true);if(mutationId&&!/^[a-f0-9]{32}$/.test(mutationId))fail('保存请求标识无效');
 const origin=o.origin===undefined?'manual':choice(o,'origin',['manual','local','backup'] as const);
 return {kind:kind as Kind,id,revision:Number(o.revision),data:o.data,mutationId,origin};
}
