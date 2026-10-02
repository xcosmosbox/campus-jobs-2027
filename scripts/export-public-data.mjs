import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,openSync,writeSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readCatalog,catalogSourceBytes} from './catalog-source.mjs';

export const publicSchema=`
CREATE TABLE catalog_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE companies (id TEXT PRIMARY KEY, company TEXT NOT NULL, industry TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE positions (id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, department TEXT NOT NULL, employment_type TEXT, education TEXT NOT NULL, start_date TEXT, end_date TEXT, campaign_status TEXT NOT NULL, verified INTEGER NOT NULL, source_url TEXT NOT NULL, entry_url TEXT NOT NULL, payload TEXT NOT NULL);
CREATE INDEX idx_positions_company ON positions(opportunity_id);
CREATE TABLE position_scans (opportunity_id TEXT PRIMARY KEY REFERENCES companies(id), status TEXT NOT NULL, checked_at TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE legacy_positions (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE position_aliases (old_id TEXT PRIMARY KEY, current_id TEXT NOT NULL REFERENCES positions(id));
`;
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const quote=value=>value===null||value===undefined?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function exportPublicData(outputDirectory=resolve('exports/public-data')){
 const destination=resolve(outputDirectory);mkdirSync(destination,{recursive:true});
 const marker=resolve(destination,'manifest.json');
 if(existsSync(resolve(destination,'jobs.sqlite'))&&(!existsSync(marker)||JSON.parse(readFileSync(marker,'utf8')).format!=='autumn27-public-data-v1'))throw new Error('Refusing to overwrite an unrecognized existing database');
 // Only checked-in public JSON is read. Runtime databases are never opened.
 const positions=readCatalog(),companies=read('opportunities.json'),scans=read('position-scans.json'),legacy=read('legacy-positions.json'),aliases=read('position-aliases.json');
 const version=sha256(catalogSourceBytes(positions));
 const suffix='.tmp-'+randomUUID(),sqliteFile=resolve(destination,'jobs.sqlite'+suffix),sqlFile=resolve(destination,'jobs.sql'+suffix);
 const database=new DatabaseSync(sqliteFile),fd=openSync(sqlFile,'w');let committed=false;
 try{
  database.exec('PRAGMA foreign_keys=ON; BEGIN;'+publicSchema);writeSync(fd,publicSchema);
  const insert=(table,columns,values,statement)=>{statement.run(...values);writeSync(fd,`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.map(quote).join(',')});\n`);};
  const metadata=database.prepare('INSERT INTO catalog_metadata VALUES (?,?)');
  for(const [key,value]of Object.entries({format:'autumn27-public-data-v1',schema_version:'1',catalog_sha256:version,position_count:String(positions.length),company_count:String(companies.length)}))insert('catalog_metadata',['key','value'],[key,value],metadata);
  const company=database.prepare('INSERT INTO companies VALUES (?,?,?,?)');
  for(const c of companies)insert('companies',['id','company','industry','payload'],[c.id,c.company,c.industry,JSON.stringify(c)],company);
  const columns=['id','opportunity_id','name','department','employment_type','education','start_date','end_date','campaign_status','verified','source_url','entry_url','payload'];
  const position=database.prepare('INSERT INTO positions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for(const p of positions)insert('positions',columns,[p.id,p.opportunityId,p.name,p.department,p.employmentType||null,p.education,p.startDate,p.endDate,p.campaignStatus,p.verified?1:0,p.sourceUrl,p.entryUrl,JSON.stringify(p)],position);
  const scan=database.prepare('INSERT INTO position_scans VALUES (?,?,?,?)');
  for(const s of scans)insert('position_scans',['opportunity_id','status','checked_at','payload'],[s.opportunityId,s.status,s.checkedAt,JSON.stringify(s)],scan);
  const old=database.prepare('INSERT INTO legacy_positions VALUES (?,?)');
  for(const p of legacy)insert('legacy_positions',['id','payload'],[p.id,JSON.stringify(p)],old);
  const alias=database.prepare('INSERT INTO position_aliases VALUES (?,?)');
  for(const [from,to]of Object.entries(aliases))insert('position_aliases',['old_id','current_id'],[from,to],alias);
  database.exec('COMMIT');committed=true;
  if(database.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Public dataset contains unresolved references');
  if(database.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Public dataset failed integrity check');
 }catch(error){if(!committed)database.exec('ROLLBACK');throw error;}finally{database.close();closeSync(fd);}
 renameSync(sqliteFile,resolve(destination,'jobs.sqlite'));renameSync(sqlFile,resolve(destination,'jobs.sql'));
 const files=['jobs.sqlite','jobs.sql'].map(name=>{const bytes=readFileSync(resolve(destination,name));return {name,bytes:bytes.length,sha256:sha256(bytes)};});
 const manifest={format:'autumn27-public-data-v1',catalogSha256:version,positions:positions.length,companies:companies.length,scans:scans.length,includesPersonalData:false,files};
 writeFileSync(marker,JSON.stringify(manifest,null,2)+'\n');return {outputDirectory:destination,...manifest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Usage: node scripts/export-public-data.mjs [--out DIRECTORY]');console.log(JSON.stringify(exportPublicData(args[1])));}
