import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const manifestUrl=new URL('../data/positions.json',import.meta.url);
export function readCatalog(){
 const manifest=JSON.parse(readFileSync(manifestUrl,'utf8'));
 if(Array.isArray(manifest))return manifest;
 if(manifest.format!=='catalog-parts-v1'||!Array.isArray(manifest.parts))throw new Error('Invalid catalog source manifest');
 const records=manifest.parts.flatMap(part=>{
  if(!/^positions\/\d+\.json$/.test(part))throw new Error('Invalid catalog source path');
  const values=JSON.parse(readFileSync(new URL(part,manifestUrl),'utf8'));
  if(!Array.isArray(values))throw new Error('Invalid catalog source part');
  return values;
 });
 if(records.length!==manifest.total||new Set(records.map(p=>p.id)).size!==manifest.total)throw new Error('Catalog source count or IDs do not match');
 return records;
}
export function catalogSourceBytes(records=readCatalog()){return Buffer.from(JSON.stringify(records,null,2)+'\n');}
export function writeCatalog(records){
 mkdirSync(new URL('../data/positions/',import.meta.url),{recursive:true});
 const parts=[];
 for(let n=0;n<records.length;n+=1000){
  const name=`positions/${parts.length}.json`;
  writeFileSync(new URL(name,manifestUrl),JSON.stringify(records.slice(n,n+1000))+'\n');
  parts.push(name);
 }
 writeFileSync(manifestUrl,JSON.stringify({format:'catalog-parts-v1',total:records.length,parts},null,2)+'\n');
}
