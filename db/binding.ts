export type WriteResult={meta:{changes:number}};
export interface PreparedStatement {
 bind(...values:unknown[]):PreparedStatement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
 run():Promise<WriteResult>;
}
export interface DatabaseBinding {
 prepare(query:string):PreparedStatement;
 batch(statements:PreparedStatement[]):Promise<WriteResult[]>;
}
export type PlatformSettings={loginProvider:'chatgpt'|'none';cookieName:string;secureCookies:boolean;publicOrigin:string|null};
