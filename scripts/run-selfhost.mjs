import {spawnSync} from 'node:child_process';
const [command,...args]=process.argv.slice(2);
if(!['dev','build','start'].includes(command))throw new Error('Expected dev, build, or start');
process.env.AUTUMN27_TARGET='sqlite';
if(command==='dev')process.env.PUBLIC_ORIGIN||='http://localhost:5173';
if(command==='start')await import('./start-selfhost.mjs');
else {
 const result=spawnSync(process.execPath,['scripts/run-framework.mjs',command,...args],{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}
