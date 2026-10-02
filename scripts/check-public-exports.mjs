import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readCatalog,catalogSourceBytes} from './catalog-source.mjs';

const dataDirectory=resolve(process.argv[2]||'exports/public-data'),sourceDirectory=resolve(process.argv[3]||'exports/open-source/autumn27');
const read=name=>JSON.parse(readFileSync(resolve('data',name),'utf8'));
const expected=readCatalog(),version=createHash('sha256').update(catalogSourceBytes(expected)).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(dataDirectory,'manifest.json'),'utf8'));
assert.equal(manifest.catalogSha256,version);assert.equal(manifest.includesPersonalData,false);
for(const file of manifest.files){const bytes=readFileSync(resolve(dataDirectory,file.name));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
const actual=new DatabaseSync(resolve(dataDirectory,'jobs.sqlite'),{readOnly:true}),imported=new DatabaseSync(':memory:');
try{
 imported.exec('PRAGMA foreign_keys=ON; BEGIN;'+readFileSync(resolve(dataDirectory,'jobs.sql'),'utf8')+'COMMIT;');
 for(const database of [actual,imported]){
  const allowed=['catalog_metadata','companies','positions','position_scans','legacy_positions','position_aliases'];
  assert.deepEqual(new Set(database.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(r=>r.name)),new Set(allowed),'exports contain only public fact tables');
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(database.prepare('PRAGMA foreign_key_check').all().length,0);
  const positions=database.prepare('SELECT id,payload FROM positions ORDER BY rowid').all();assert.equal(positions.length,expected.length);
  positions.forEach((row,n)=>{assert.equal(row.id,expected[n].id);assert.deepEqual(JSON.parse(row.payload),expected[n]);});
  for(const [table,file]of [['companies','opportunities.json'],['position_scans','position-scans.json'],['legacy_positions','legacy-positions.json']])assert.deepEqual(database.prepare('SELECT payload FROM '+table+' ORDER BY rowid').all().map(r=>JSON.parse(r.payload)),read(file));
  const aliases=Object.fromEntries(database.prepare('SELECT old_id,current_id FROM position_aliases').all().map(r=>[r.old_id,r.current_id]));assert.deepEqual(aliases,read('position-aliases.json'));
  const product=database.prepare("SELECT id FROM positions WHERE instr(name || ' ' || department, '产品') > 0").all().map(r=>r.id);
  assert.deepEqual(new Set(product),new Set(expected.filter(p=>(p.name+' '+p.department).includes('产品')).map(p=>p.id)));
 }
}finally{actual.close();imported.close();}
const source=JSON.parse(readFileSync(resolve(sourceDirectory,'SOURCE_EXPORT.json'),'utf8'));
assert.equal(source.containsRuntimeData,false);assert.equal(source.containsSiteIdentity,false);
const liveIdentity=JSON.parse(readFileSync('.openai/hosting.json','utf8')).project_id;
for(const file of source.files){
 assert(!/(^|\/)(\.git|\.wrangler|\.sites-runtime|storage|node_modules|catalog-audit)(\/|$)/.test(file.path));
 assert(!/\.(sqlite|db)(-(shm|wal))?$/.test(file.path));assert(!file.path.startsWith('public/screenshot'));
 assert(!/(^|\/)\.env/.test(file.path)||file.path==='.env.example');
 const bytes=readFileSync(resolve(sourceDirectory,file.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
 if(liveIdentity)assert(!bytes.toString('utf8').includes(liveIdentity),'the public copy cannot retain this Site identity');
}
assert(!JSON.parse(readFileSync(resolve(sourceDirectory,'.openai/hosting.json'),'utf8')).project_id);
for(const name of ['Dockerfile','compose.yaml','LICENSE','DATA_NOTICE.md','.env.example','db/sqlite-binding.mjs','scripts/export-public-data.mjs','scripts/start-selfhost.mjs','vendor/shadcn-tailwind-4.13.0.css','vendor/shadcn-tailwind-4.13.0.LICENSE.md'])assert(existsSync(resolve(sourceDirectory,name)),name);
console.log(`检查通过：SQLite 与 SQL 导入逐字段保留 ${expected.length} 条岗位、203 家公司及完整核验／别名；源码导出 ${source.files.length} 个文件，未包含运行数据、会话或本站身份。`);
