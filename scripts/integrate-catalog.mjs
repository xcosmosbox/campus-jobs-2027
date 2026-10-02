import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {writeCatalog} from './catalog-source.mjs';

// Research output stays separate from the Site; only its owner runs integration.
const folder=resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Provide the research staging folder');
const read=name=>JSON.parse(readFileSync(resolve(folder,name),'utf8'));
const originals=read('base-positions.json');
const legacy=JSON.parse(readFileSync(new URL('../data/legacy-positions.json',import.meta.url),'utf8'));
const legacyIds=new Set(legacy.map(p=>p.id));
const byId=new Map(originals.filter(p=>!legacyIds.has(p.id)).map(p=>[p.id,p]));
const companies=JSON.parse(readFileSync(new URL('../data/opportunities.json',import.meta.url),'utf8'));
const scans=new Map(),reviews=new Map(),hashes=new Map();
for(let n=1;n<=6;n++){
 const recordsHash=createHash('sha256').update(readFileSync(resolve(folder,`records-${n}.json`))).digest('hex'),scanHash=createHash('sha256').update(readFileSync(resolve(folder,`scan-${n}.json`))).digest('hex');
 for(const p of read(`records-${n}.json`)){if(!companies.some(c=>c.id===p.opportunityId))throw new Error(`Unknown employer: ${p.id}`);if(p.deadlineLabel===null)p.deadlineLabel=p.endDate?'':'岗位起止日期未确认';byId.set(p.id,p);}
 for(const s of read(`scan-${n}.json`)){if(scans.has(s.opportunityId))throw new Error(`Overlapping shard: ${s.opportunityId}`);scans.set(s.opportunityId,s);hashes.set(s.opportunityId,{sourceRecordsSha256:recordsHash,sourceScanSha256:scanHash});}
 for(const name of [`review-${n}.json`,`review-second-${n}.json`])if(existsSync(resolve(folder,name))){for(const r of read(name)){if(r.reviewedRecordsSha256!==recordsHash||r.reviewedScanSha256!==scanHash)throw new Error(`Stale independent review: ${r.opportunityId} (${name})`);const group=reviews.get(r.opportunityId)||[];group.push(r);reviews.set(r.opportunityId,group);for(const id of r.dropIds||[])byId.delete(id);for(const patch of r.patches||[]){const old=byId.get(patch.id);if(old)byId.set(patch.id,{...old,...patch.changes});}}}
}
const positions=[...byId.values()];
const result=companies.map(c=>{
 const s=scans.get(c.id);if(!s)throw new Error(`No actual scan: ${c.company}`);
 const rr=reviews.get(c.id)||[];
 const independentCount=new Set(rr.map(r=>r.reviewer).filter(Boolean)).size;
 const decisions=rr.map(r=>r.decision),accepted=independentCount>=2&&decisions.every(d=>d==='accepted');
 const review={status:independentCount<2?'pending':accepted?'accepted':'limited',reviewer:rr.map(r=>r.reviewer).filter(Boolean).join('、'),note:rr.map(r=>r.note).join('；')};
 const overrides=rr.filter(r=>r.statusOverride);const status=overrides.at(-1)?.statusOverride||(!accepted&&rr.length&&s.status==='complete'?'partial':s.status);
 return {...s,attempts:s.attempts.map(a=>({url:null,query:null,ref:null,...a})),...hashes.get(c.id),status,company:c.company,industry:c.industry,importedRoles:positions.filter(p=>p.opportunityId===c.id).length,review,independentReviews:rr};
});
writeCatalog(positions);
writeFileSync(new URL('../data/position-scans.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({roles:positions.length,companiesWithRoles:new Set(positions.map(p=>p.opportunityId)).size,scanned:result.length,statuses:result.reduce((a,s)=>(a[s.status]=(a[s.status]||0)+1,a),{}),reviewsPending:result.filter(s=>s.review.status==='pending').length}));
