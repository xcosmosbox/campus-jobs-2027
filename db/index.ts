import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type {DatabaseBinding,PlatformSettings} from './binding';

export function platformSettings():PlatformSettings {
  return {loginProvider:'chatgpt',cookieName:import.meta.env.DEV?'autumn27-preview-session':'__Host-autumn27-session',secureCookies:!import.meta.env.DEV,publicOrigin:null};
}

export function clientAddress(request:Request):string|null{return request.headers.get('cf-connecting-ip');}

export async function getCatalogAsset(path: string): Promise<Response> {
  if (!env.ASSETS) throw new Error("Catalog asset binding is unavailable");
  return env.ASSETS.fetch(new Request(new URL(path, "https://assets.internal")));
}

export function getBinding(): DatabaseBinding {
  if (!env.DB) throw new Error('Workspace database is unavailable');
  return env.DB;
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
