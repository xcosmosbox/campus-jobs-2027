import data from '@/data/opportunities.json';

export type Opportunity = {
  id: string; industry: string; rank: string; company: string; period: string;
  originalVerification: string; entryText: string; entries: string[]; sources: string[];
  evidence: string; checkedAt: string; verification: string; startDate: string | null;
  endDate: string | null; endTime: string | null; confirmed: boolean; note: string;
  reviewStatus?: 'confirmed' | 'unconfirmed' | 'not_started'; reviewReason?: string;
  campaignStatus?: 'open' | 'closed' | 'upcoming' | 'unknown';
  deadlineLabel?: string | null; scopeLabel?: string | null;
  startTime?: string | null; applicationEmail?: string | null; applicationMethod?: string | null; entryLabel?: string | null;
  originalPeriod?: string;
  independentReview?: {decision: string; reason: string; sources: string[]; refs: string[]};
  audit?: {attemptedAt: string; attempts: {url: string | null; query: string | null; outcome: string; ref: string | null}[]; supportingRefs: string[]};
};
export type Filters = {industry: string; company: string; status: string; deadline: string; cutoff: string; verifiedOnly: boolean; sort: string};
export const defaults: Filters = {industry:'全部',company:'',status:'all',deadline:'all',cutoff:'',verifiedOnly:false,sort:'deadline'};
export const industries = ['互联网','央国企','金融','银行'];
export const opportunities: Opportunity[] = data as Opportunity[];
export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function daysLeft(r: Opportunity, today: string) {
  return r.confirmed && r.endDate ? Math.round((Date.parse(r.endDate+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000) : null;
}
export function statusOf(r: Opportunity, today: string, now?: Date) {
  if (!r.confirmed) return 'unknown';
  if (r.endDate && r.endDate < today) return 'closed';
  if (r.endDate && r.endTime && now) {
    const time=r.endTime==='24:00'?'23:59:59.999':r.endTime;
    if (now.getTime()>Date.parse(`${r.endDate}T${time}+08:00`)) return 'closed';
  }
  if (r.startDate && r.startDate>today) return 'upcoming';
  if (r.startDate && r.startTime && now && now.getTime()<Date.parse(`${r.startDate}T${r.startTime}+08:00`)) return 'upcoming';
  if (r.campaignStatus && r.campaignStatus!=='open') return r.campaignStatus;
  return 'open';
}
export const statusLabels:Record<string,string>={open:'开放中',closed:'已截止',upcoming:'尚未开始',unknown:'状态未确认'};
export function reviewLabel(r:Opportunity) {
  if(r.confirmed) return r.verification==='employer'?'雇主简章已核验':'官方来源已核验';
  return r.reviewStatus==='unconfirmed'?'核验后未确认':'尚未核验';
}
export function filterOpportunities(records:Opportunity[], filters:Filters, today:string, now?:Date) {
  const q=filters.company.trim().toLocaleLowerCase();
  return records.filter(r=>{
    if(filters.industry!=='全部'&&r.industry!==filters.industry)return false;
    if(q&&!r.company.toLocaleLowerCase().includes(q))return false;
    if(filters.status!=='all'&&statusOf(r,today,now)!==filters.status)return false;
    if(filters.verifiedOnly&&!r.confirmed)return false;
    const left=daysLeft(r,today);
    if(filters.deadline==='unknown'&&r.endDate!==null)return false;
    if(['7','14','30'].includes(filters.deadline)&&(left===null||left<0||left>Number(filters.deadline)||statusOf(r,today,now)==='closed'))return false;
    if(filters.cutoff&&(!r.endDate||r.endDate>filters.cutoff))return false;
    return true;
  }).sort((a,b)=>{
    if(filters.sort==='company')return a.company.localeCompare(b.company,'zh-CN');
    if(filters.sort==='industry')return industries.indexOf(a.industry)-industries.indexOf(b.industry);
    const tier=(r:Opportunity)=>statusOf(r,today,now)==='closed'?3:r.endDate?0:r.confirmed?1:2;
    return tier(a)-tier(b)||(a.endDate||'9999').localeCompare(b.endDate||'9999')||a.company.localeCompare(b.company,'zh-CN');
  });
}
export function validateFilters(input:unknown): Partial<Filters> {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('筛选参数必须是对象');
  const v=input as Record<string,unknown>;const valid:Partial<Filters>={};
  for(const key of Object.keys(v)){
    if(!Object.hasOwn(defaults,key))throw new Error(`未知筛选项：${key}`);
    const value=v[key];
    if(key==='verifiedOnly'){if(typeof value!=='boolean')throw new Error('verifiedOnly 必须是布尔值'); valid.verifiedOnly=value;continue;}
    if(typeof value!=='string')throw new Error(`${key} 必须是字符串`);
    if(key==='industry'&&!['全部',...industries].includes(value))throw new Error('行业无效');
    if(key==='status'&&!['all','open','closed','upcoming','unknown'].includes(value))throw new Error('状态无效');
    if(key==='deadline'&&!['all','7','14','30','unknown'].includes(value))throw new Error('截止范围无效');
    if(key==='sort'&&!['deadline','company','industry'].includes(value))throw new Error('排序无效');
    if(key==='cutoff'&&value){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('截止日期无效');
    }
    Object.assign(valid,{[key]:value});
  }return valid;
}
