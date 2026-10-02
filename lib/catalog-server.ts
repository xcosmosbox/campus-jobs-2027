import {getCatalogAsset} from '@/db';
import catalogIndex from '@/data/catalog-index.json';
import type {Position} from './workspace';

const index=catalogIndex as {version:string;byId:Record<string,number>};
// Keep the full source out of the worker bundle. Only two public data parts
// remain cached; personal progress checks need the ID index alone.
const parts=new Map<number,Map<string,Position>>();
export function hasCatalogPosition(id:string):boolean{return Object.hasOwn(index.byId,id);}
export async function originalCatalogPosition(id:string):Promise<Position|undefined>{
 if(!hasCatalogPosition(id))return undefined;
 const part=index.byId[id],cached=parts.get(part);
 if(cached){parts.delete(part);parts.set(part,cached);return cached.get(id);}
 const response=await getCatalogAsset(`/catalog/${index.version}/${part}.json`);
 if(!response.ok)throw new Error('Catalog source part is unavailable');
 const payload=await response.json() as {version?:string;part?:number;records?:Position[]};
 if(payload.version!==index.version||payload.part!==part||!Array.isArray(payload.records))throw new Error('Catalog source version mismatch');
 const records=new Map(payload.records.map(record=>[record.id,record]));
 if(records.size!==payload.records.length||!records.has(id))throw new Error('Catalog source record is missing or duplicated');
 parts.set(part,records);
 if(parts.size>2)parts.delete(parts.keys().next().value!);
 return records.get(id);
}
