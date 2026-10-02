import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
function git(...args){const result=spawnSync('git',args,{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Git configuration failed');return result.stdout.trim();}
const root=fileURLToPath(new URL('..',import.meta.url)),checkout=git('rev-parse','--show-toplevel');
if(resolve(checkout)!==resolve(root))throw new Error('Run this script in the campus-jobs-2027 repository.');
const origin=git('remote','get-url','origin');
if(!/^https:\/\/github\.com\/xcosmosbox\/campus-jobs-2027(?:\.git)?\/?$/.test(origin)&&!/^git@github\.com:xcosmosbox\/campus-jobs-2027(?:\.git)?$/.test(origin))throw new Error('Owner identity setup is only for xcosmosbox/campus-jobs-2027.');
git('config','--local','user.name','xcosmosbox');
git('config','--local','user.email','56502269+xcosmosbox@users.noreply.github.com');
git('config','--local','user.useConfigOnly','true');
git('config','--local','core.hooksPath','.githooks');
console.log('Configured this checkout for the owner; global Git settings are unchanged.');
