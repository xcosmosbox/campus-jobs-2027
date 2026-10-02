import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

// The application uses the same prepared SQL and atomic batches on D1 and
// SQLite. This adapter owns only the Node connection and startup migrations.
export function openSqliteBinding(filename,{migrationDirectory=resolve('drizzle')}={}){
 if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
 const database=new DatabaseSync(filename);
 database.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 try{
  database.exec('BEGIN IMMEDIATE');
  database.exec('CREATE TABLE IF NOT EXISTS _autumn27_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for(const name of readdirSync(migrationDirectory).filter(n=>/^\d+_[\w-]+\.sql$/.test(n)).sort()){
   const sql=readFileSync(resolve(migrationDirectory,name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
   const applied=database.prepare('SELECT sha256 FROM _autumn27_migrations WHERE name=?').get(name);
   if(applied){if(applied.sha256!==hash)throw new Error(`Applied migration changed: ${name}`);continue;}
   database.exec(sql);
   database.prepare('INSERT INTO _autumn27_migrations VALUES (?,?,?)').run(name,hash,new Date().toISOString());
  }
  database.exec('COMMIT');
 }catch(error){database.exec('ROLLBACK');database.close();throw error;}
 class Statement{
  constructor(query,values=[]){this.query=query;this.values=values;}
  bind(...values){return new Statement(this.query,values);}
  async first(){return database.prepare(this.query).get(...this.values)||null;}
  async all(){return {results:database.prepare(this.query).all(...this.values)};}
  execute(){return {meta:{changes:Number(database.prepare(this.query).run(...this.values).changes)}};}
  async run(){return this.execute();}
 }
 return {
  prepare(query){return new Statement(query);},
  async batch(statements){database.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}},
  close(){database.close();},
 };
}
