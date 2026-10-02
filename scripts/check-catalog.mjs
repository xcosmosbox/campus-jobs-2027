import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {readCatalog} from './catalog-source.mjs';

// Validate the imported catalog with the same rules used by saved user records.
const loaded=new Map();
function load(name){if(loaded.has(name))return loaded.get(name);const filename=fileURLToPath(new URL('../lib/'+name+'.cjs',import.meta.url)),m=new Module(filename);m.filename=filename;const native=m.require.bind(m);m.require=p=>p.startsWith('./')?load(p.slice(2)):p.startsWith('@/data/')?native('../data/'+p.slice(7)):native(p);m._compile(ts.transpileModule(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);loaded.set(name,m.exports);return m.exports;}
const {validatePosition,validateEnvelope}=load('workspace-validation');
const positions=readCatalog();
const companies=JSON.parse(readFileSync(new URL('../data/opportunities.json',import.meta.url),'utf8'));
const scans=JSON.parse(readFileSync(new URL('../data/position-scans.json',import.meta.url),'utf8'));
const staging=process.argv.indexOf('--staging');
const catalog=staging>=0?JSON.parse(readFileSync(process.argv[staging+1],'utf8')):positions;
const failures=[];
for(const p of catalog){try{validateEnvelope({kind:'position',id:p.id,revision:0,data:p});validatePosition({...p,acknowledged:true},p.id,true);assert(p.verified&&p.sourceUrl&&p.evidence,'catalog import requires an actually read source');}catch(e){failures.push({id:p.id,company:p.opportunityId,name:p.name,error:e.message});}}
assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length,'duplicate catalog IDs');
if(failures.length){console.error(JSON.stringify(failures.slice(0,40),null,2));throw new Error(`${failures.length} catalog rows fail validation`);}
if(staging<0){
 assert.equal(companies.length,203);
 assert.equal(scans.length,203,'every company must have an actual scan record');
 assert.equal(new Set(scans.map(s=>s.opportunityId)).size,203);
 const aliases=JSON.parse(readFileSync(new URL('../data/position-aliases.json',import.meta.url),'utf8'));
 const legacy=JSON.parse(readFileSync(new URL('../data/legacy-positions.json',import.meta.url),'utf8'));
 for(const p of legacy)assert(!positions.some(r=>r.id===p.id),'previous summaries must not duplicate real catalogue roles');
 for(const [old,target] of Object.entries(aliases)){assert(!positions.some(p=>p.id===old),'merged directions cannot inflate catalogue count');assert(positions.some(p=>p.id===target),'legacy tracking needs a live canonical target');}
 const counts=new Map();for(const p of positions)counts.set(p.opportunityId,(counts.get(p.opportunityId)||0)+1);
 for(const c of companies){const scan=scans.find(s=>s.opportunityId===c.id);assert(scan,c.id);assert.equal(scan.company,c.company);assert(scan.attempts.length>0,`${c.company}: no actual documented attempt`);assert(scan.scope&&scan.reason,`${c.company}: scope/reason missing`);assert(['complete','partial','blocked','no_current','no_roles'].includes(scan.status));assert(scan.review.status!=='pending',`${c.company}: independent review missing`);assert.equal(scan.importedRoles,counts.get(c.id)||0,`${c.company}: count mismatch`);assert(new Set(scan.independentReviews?.map(r=>r.reviewer)).size>=2,`${c.company}: two independent reviews required`);for(const r of scan.independentReviews){assert(r.reviewer&&r.note,`${c.company}: unsigned review`);assert.equal(r.reviewedRecordsSha256,scan.sourceRecordsSha256,`${c.company}: stale role review`);assert.equal(r.reviewedScanSha256,scan.sourceScanSha256,`${c.company}: stale scope review`);assert(['accepted','limited','rejected'].includes(r.decision));}if(scan.status==='complete')assert(scan.sourceUrls.length>0&&scan.review.status==='accepted',`${c.company}: complete claim requires source and accepted independent review`);}
}
console.log(`检查通过：${catalog.length} 条岗位的字段、来源、稳定标识${staging<0?'及 203 家公司的覆盖记录和独立复核':''}。`);
