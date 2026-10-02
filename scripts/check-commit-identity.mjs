import {spawnSync} from 'node:child_process';
const expectedName='xcosmosbox',expectedEmail='56502269+xcosmosbox@users.noreply.github.com';
function git(...args){const result=spawnSync('git',args,{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Git identity check failed');return result.stdout.trim();}
const mode=process.argv[2]||'--pending';
if(mode==='--pending'){
 for(const kind of ['GIT_AUTHOR_IDENT','GIT_COMMITTER_IDENT']){
  const identity=git('var',kind),match=identity.match(/^(.*?) <([^>]+)> /);
  if(!match||match[1]!==expectedName||match[2]!==expectedEmail)throw new Error(`${kind} must use the repository owner's configured identity; run node scripts/configure-owner-git.mjs.`);
 }
}else if(mode==='--head'){
 const [authorName,authorEmail,committerName,committerEmail]=git('show','-s','--format=%an%n%ae%n%cn%n%ce','HEAD').split('\n');
 if(authorName!==expectedName||committerName!==expectedName||authorEmail!==expectedEmail||committerEmail!==expectedEmail)throw new Error('The outgoing HEAD must use the owner as both author and committer.');
}else throw new Error('Expected --pending or --head');
console.log('Owner Git identity verified.');
