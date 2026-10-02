import {mergeCaches,type Cache} from './workspace-cache';
export interface CacheStorage{last():Promise<Cache|null>;get(scope:string):Promise<Cache|null>;put(cache:Cache):Promise<Cache>;list():Promise<Cache[]>;}
let dbPromise:Promise<IDBDatabase>|null=null;
function db(){if(!dbPromise)dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('autumn27-personal-data',1);r.onupgradeneeded=()=>{r.result.createObjectStore('spaces',{keyPath:'scope'});r.result.createObjectStore('meta');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>{dbPromise=null;reject(new Error('浏览器本地保存不可用'));};r.onblocked=()=>{dbPromise=null;reject(new Error('请关闭其他旧版页面后重试本地保存'));};});return dbPromise;}
async function read<T>(store:string,key:IDBValidKey):Promise<T|undefined>{const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readonly'),r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export const browserStorage:CacheStorage={
 async last(){const key=await read<string>('meta','active');return key?await this.get(key):null;},
 async get(scope){return (await read<Cache>('spaces',scope))||null;},
 async list(){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('spaces','readonly'),r=t.objectStore('spaces').getAll();r.onsuccess=()=>resolve(r.result as Cache[]);r.onerror=()=>reject(r.error);});},
 async put(cache){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(['spaces','meta'],'readwrite'),s=t.objectStore('spaces'),r=s.get(cache.scope);let merged=cache;r.onsuccess=()=>{merged=mergeCaches(r.result||null,cache);s.put(merged);t.objectStore('meta').put(cache.scope,'active');};t.oncomplete=()=>resolve(merged);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('本地保存被中断'));});},
};
