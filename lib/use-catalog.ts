'use client';
import {useEffect,useState} from 'react';
import metadata from '@/data/catalog-meta.json';
import {loadCatalog} from './catalog-loader';
import type {Position} from './workspace';
export function useCatalog(){
 const [positions,setPositions]=useState<Position[]>([]),[loaded,setLoaded]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');setProgress(0);
  loadCatalog(metadata,fetch,controller.signal,n=>{if(!controller.signal.aborted)setProgress(n);}).then(records=>{if(!controller.signal.aborted){setPositions(records);setLoaded(true);}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'岗位读取失败，请重试');});
  return()=>controller.abort();
 },[attempt]);
 return {positions,loaded,progress,error,total:metadata.total,retry:()=>setAttempt(n=>n+1)};
}
