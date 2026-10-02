import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,lstatSync,readdirSync,rmSync} from 'node:fs';
import {resolve,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const directories=['app','components','lib','db','drizzle','scripts','build','vendor','.githooks','datasets'];
const files=['package.json','pnpm-lock.yaml','tsconfig.json','next.config.ts','vite.config.ts','postcss.config.mjs','eslint.config.mjs','components.json','cloudflare-env.d.ts','Dockerfile','compose.yaml','.dockerignore','.gitignore','.env.example','README.md','LICENSE','DATA_NOTICE.md','AGENTS.md'];
const publicData=['opportunities.json','positions.json','legacy-positions.json','position-aliases.json','position-scans.json','catalog-index.json','catalog-meta.json'];
function safeFilter(path){if(lstatSync(path).isSymbolicLink())throw new Error('Symlinks are not allowed in the public source export');const name=basename(path);return !['.git','.wrangler','.sites-runtime','node_modules','storage','exports','outputs'].includes(name)&&(!name.startsWith('.env')||name==='.env.example')&&!/\.(sqlite|db)(-(wal|shm))?$/.test(name);}
function walk(folder,result=[]){for(const name of readdirSync(folder)){const path=resolve(folder,name);if(lstatSync(path).isDirectory())walk(path,result);else result.push(path);}return result;}
export function exportOpenSource(outputDirectory=resolve('exports/open-source')){
 const output=resolve(outputDirectory),destination=resolve(output,'autumn27');
 if(destination===resolve(root)||resolve(root).startsWith(destination+'/'))throw new Error('Export destination cannot contain the active checkout');
 if(existsSync(destination)){const marker=resolve(destination,'SOURCE_EXPORT.json');if(!existsSync(marker)||JSON.parse(readFileSync(marker,'utf8')).format!=='autumn27-source-export-v1')throw new Error('Refusing to replace an unrecognized directory');rmSync(destination,{recursive:true});}
 mkdirSync(destination,{recursive:true});
 const copy=(from,to=from)=>{const source=resolve(root,from);if(!existsSync(source))throw new Error('Missing source export file: '+from);cpSync(source,resolve(destination,to),{recursive:true,filter:safeFilter});};
 for(const directory of directories)copy(directory);for(const file of files)copy(file);
 mkdirSync(resolve(destination,'data'),{recursive:true});for(const name of publicData)copy('data/'+name);copy('data/positions');
 mkdirSync(resolve(destination,'public'),{recursive:true});copy('public/favicon.svg');
 mkdirSync(resolve(destination,'docs'),{recursive:true});for(const name of ['self-hosting.md','data-model.md','selfhost-verification.md','commit-identity.md'])copy('docs/'+name);
 const verification=readFileSync(resolve(root,'docs/catalog-verification.md'),'utf8').replace(/^`catalog-audit\/`[^\n]+/m,'公共源码包含岗位数据、来源、覆盖范围及两轮独立复核结论。原始抓取与研究归档不在公共源码包中。');
 writeFileSync(resolve(destination,'docs/catalog-verification.md'),verification);
 mkdirSync(resolve(destination,'.openai'),{recursive:true});writeFileSync(resolve(destination,'.openai/hosting.json'),JSON.stringify({d1:'DB',r2:null},null,2)+'\n');
 const exported=walk(destination).map(path=>({path:relative(destination,path),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
 writeFileSync(resolve(destination,'SOURCE_EXPORT.json'),JSON.stringify({format:'autumn27-source-export-v1',containsRuntimeData:false,containsSiteIdentity:false,files:exported},null,2)+'\n');
 const archive=resolve(output,'autumn27-open-source.tar.gz');const packaged=spawnSync('tar',['-czf',archive,'-C',output,'autumn27'],{stdio:'inherit'});if(packaged.error)throw packaged.error;if(packaged.status!==0)throw new Error('Unable to package public source');
 return {sourceDirectory:destination,archive,files:exported.length,archiveSha256:createHash('sha256').update(readFileSync(archive)).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Usage: node scripts/export-open-source.mjs [--out DIRECTORY]');console.log(JSON.stringify(exportOpenSource(args[1])));}
