import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readCatalog,catalogSourceBytes} from './catalog-source.mjs';
const records=readCatalog(),source=catalogSourceBytes(records),version=createHash('sha256').update(source).digest('hex');
const partSize=1000,parts=[],byId={};
const directory=new URL(`../public/catalog/${version}/`,import.meta.url);
mkdirSync(directory,{recursive:true});
for(let offset=0;offset<records.length;offset+=partSize){
 const part=parts.length,name=`${part}.json`;
 for(const record of records.slice(offset,offset+partSize)){
  if(Object.hasOwn(byId,record.id))throw new Error(`重复岗位：${record.id}`);
  byId[record.id]=part;
 }
 const payload=JSON.stringify({version,part,records:records.slice(offset,offset+partSize)});
 writeFileSync(new URL(name+'.tmp',directory),payload);
 renameSync(new URL(name+'.tmp',directory),new URL(name,directory));
 parts.push(`/catalog/${version}/${name}`);
}
writeFileSync(new URL('../data/catalog-meta.json',import.meta.url),JSON.stringify({version,total:records.length,parts},null,2)+'\n');
writeFileSync(new URL('../data/catalog-index.json',import.meta.url),JSON.stringify({version,byId})+'\n');
console.log(`岗位数据已分为 ${parts.length} 份，合计 ${records.length} 条。`);
