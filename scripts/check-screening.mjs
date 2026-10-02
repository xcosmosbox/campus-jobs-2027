import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const filename=fileURLToPath(new URL('../lib/screening.cjs',import.meta.url));
const source=readFileSync(new URL('../lib/screening.ts',import.meta.url),'utf8').replace("'@/data/opportunities.json'","'../data/opportunities.json'");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module=new Module(filename); module.filename=filename;
module._compile(code,filename);
const {opportunities:all,defaults,filterOpportunities:filter,statusOf,shanghaiDate,daysLeft,validateFilters,reviewLabel}=module.exports;
const today='2026-10-01',now=new Date('2026-10-01T10:00:00+08:00');
const run=changes=>filter(all,{...defaults,...changes},today,now);
assert.equal(all.length,203);
assert.equal(new Set(all.map(r=>r.id)).size,203);
assert.deepEqual(['互联网','央国企','金融','银行'].map(industry=>run({industry}).length),[50,50,53,50]);
assert.equal(run({industry:'银行',company:' 中国银行 ',status:'open',verifiedOnly:true}).length,1);
assert.equal(run({industry:'互联网',company:'中国银行'}).length,0);
assert(run({verifiedOnly:true}).every(r=>r.confirmed));
assert(run({status:'unknown'}).every(r=>statusOf(r,today,now)==='unknown'));
assert(run({deadline:'unknown'}).every(r=>r.endDate===null));
assert(run({deadline:'30'}).every(r=>r.confirmed&&r.endDate&&statusOf(r,today,now)!=='closed'));

// Controlled fixtures cover AND combinations and date boundaries independently of current data.
const base={...all[0],confirmed:true,reviewStatus:'confirmed',verification:'official',campaignStatus:'open',industry:'银行',company:'测试银行',startDate:'2026-09-01',endDate:'2026-10-07',endTime:'24:00'};
const fixtures=[base,{...base,id:'past',company:'过期银行',endDate:'2026-09-30'}, {...base,id:'unknown',company:'待确认银行',confirmed:false,reviewStatus:'unconfirmed',campaignStatus:'unknown',startDate:null,endDate:null,endTime:null}, {...base,id:'future',company:'未来银行',campaignStatus:'upcoming',startDate:'2026-10-02',endDate:'2026-10-20'}];
const sample=changes=>filter(fixtures,{...defaults,...changes},today,now);
assert.equal(sample({deadline:'7'}).length,1);
assert.equal(sample({cutoff:'2026-10-07'}).length,2);
assert.equal(sample({cutoff:'2026-10-07',status:'open'}).length,1);
assert.equal(sample({company:'测试',industry:'互联网'}).length,0);
assert.equal(sample({deadline:'unknown'}).length,1);
assert.equal(sample({status:'upcoming'}).length,1);
assert.equal(daysLeft(base,today),6);
assert.equal(daysLeft(fixtures[2],today),null);
assert.equal(statusOf({...base,campaignStatus:'unknown'},today,now),'unknown');
assert.equal(reviewLabel({...base,verification:'employer'}),'雇主简章已核验');
assert.equal(reviewLabel(fixtures[2]),'核验后未确认');
assert.equal(reviewLabel({...fixtures[2],reviewStatus:'not_started'}),'尚未核验');
assert.equal(shanghaiDate(new Date('2026-09-30T16:00:00Z')),'2026-10-01');
const timed={...base,endDate:today,endTime:'20:00'};
assert.equal(statusOf(timed,today,new Date('2026-10-01T19:59:00+08:00')),'open');
assert.equal(statusOf(timed,today,new Date('2026-10-01T20:00:01+08:00')),'closed');
assert.equal(statusOf({...timed,endTime:'24:00'},today,new Date('2026-10-01T23:59:59+08:00')),'open');
assert.equal(statusOf({...timed,endTime:'24:00'},'2026-10-02',new Date('2026-10-02T00:00:00+08:00')),'closed');
const starting={...base,startDate:today,startTime:'09:00'};
assert.equal(statusOf(starting,today,new Date('2026-10-01T08:59:59+08:00')),'upcoming');
assert.equal(statusOf(starting,today,new Date('2026-10-01T09:00:00+08:00')),'open');
assert.throws(()=>validateFilters({cutoff:'2026-02-30'}));
assert.throws(()=>validateFilters({status:'applied'}));
assert.throws(()=>validateFilters({verifiedOnly:'true'}));
assert.throws(()=>validateFilters({constructor:'invalid'}));
assert.deepEqual(validateFilters({industry:'银行',cutoff:'2026-10-07',verifiedOnly:true}),{industry:'银行',cutoff:'2026-10-07',verifiedOnly:true});

for(const r of all){
 assert(['confirmed','unconfirmed'].includes(r.reviewStatus),`${r.company} 未完成本轮查询`);
 assert.equal(r.checkedAt,'2026-10-01');
 assert.equal(r.audit?.attemptedAt,'2026-10-01');
 assert(r.audit?.attempts.length>0,`${r.company} 无查证尝试`);
 assert(r.audit.attempts.every(a=>(a.url||a.query)&&typeof a.outcome==='string'&&a.outcome.trim()),`${r.company} 查证记录不完整`);
 assert(['accept','amend','downgrade'].includes(r.independentReview?.decision)&&r.independentReview.reason,`${r.company} 缺少独立审查结论`);
 assert(r.entries.every(url=>/^https?:\/\//.test(url)&&!/[\s<>]/.test(url)));
 assert(r.sources.every(url=>/^https?:\/\//.test(url)&&!/[\s<>]/.test(url)));
 assert.equal(r.confirmed,r.reviewStatus==='confirmed');
 assert(['open','closed','upcoming','unknown'].includes(r.campaignStatus));
 if(r.confirmed){
  assert(['official','employer'].includes(r.verification));
  assert(r.sources.length&&(r.entries.length||r.applicationEmail||r.applicationMethod)&&r.evidence);
  assert(r.audit.supportingRefs.length,`${r.company} 缺少支持结论的读取引用`);
 }else{
  assert(r.reviewReason,`${r.company} 无未确认原因`);
  assert.equal(r.startDate,null); assert.equal(r.endDate,null); assert.equal(r.endTime,null);
 }
 if(r.applicationEmail)assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.applicationEmail));
 if(r.startTime)assert(r.startDate&&/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(r.startTime));
 if(r.endTime)assert(r.endDate&&/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$|^24:00$/.test(r.endTime));
 for(const date of [r.startDate,r.endDate].filter(Boolean))assert.equal(new Date(date+'T00:00:00Z').toISOString().slice(0,10),date);
 if(r.startDate&&r.endDate)assert(r.startDate<=r.endDate);
}
console.log(`检查通过：203/203有实际查询记录；当届来源确认${all.filter(r=>r.confirmed).length}，查询后未确认${all.filter(r=>!r.confirmed).length}。筛选组合、日期边界和核验标签均通过。`);
