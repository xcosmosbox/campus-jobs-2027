import type {Position} from './workspace';
export type CatalogMeta={version:string;total:number;parts:string[]};
export async function loadCatalog(meta:CatalogMeta,fetcher:typeof fetch,signal:AbortSignal,onProgress:(n:number)=>void):Promise<Position[]>{
 const result:Position[][]=[];let read=0;
 for(let start=0;start<meta.parts.length;start+=3){
  const batch=await Promise.all(meta.parts.slice(start,start+3).map(async(path,index)=>{
   const response=await fetcher(path,{signal,credentials:'same-origin',cache:'force-cache'});
   if(!response.ok)throw new Error('岗位数据暂未读取成功，请重试');
   const raw:unknown=await response.json();
   if(!raw||typeof raw!=='object')throw new Error('岗位数据版本不一致，请刷新后重试');
   const data=raw as {version?:unknown;part?:unknown;records?:unknown};
   if(data.version!==meta.version||data.part!==start+index||!Array.isArray(data.records))throw new Error('岗位数据版本不一致，请刷新后重试');
   return data.records as Position[];
  }));
  if(signal.aborted)throw new Error('已取消岗位读取');
  result.push(...batch);read+=batch.reduce((n,p)=>n+p.length,0);onProgress(read);
 }
 const records=result.flat();
 if(records.length!==meta.total||new Set(records.map(p=>p.id)).size!==meta.total)throw new Error('岗位数据未完整读取，请重试');
 return records;
}
