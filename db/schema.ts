import {integer, sqliteTable, text, primaryKey, index, uniqueIndex} from 'drizzle-orm/sqlite-core';

export const workspaceRecords = sqliteTable('workspace_records', {
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  itemId: text('item_id').notNull(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
  lastEventId: text('last_event_id').notNull(),
}, table => [primaryKey({columns:[table.userId, table.kind, table.itemId]})]);

export const workspaceEvents = sqliteTable('workspace_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  itemId: text('item_id').notNull(),
  summary: text('summary').notNull(),
  changes: text('changes').notNull(),
  sourceUrl: text('source_url'),
  createdAt: text('created_at').notNull(),
}, table => [index('idx_workspace_events_user_time').on(table.userId,table.createdAt,table.id)]);

export const workspaceSpaces=sqliteTable('workspace_spaces',{
 id:text('id').primaryKey(),recoveryHash:text('recovery_hash'),generation:integer('generation').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('idx_workspace_spaces_recovery').on(t.recoveryHash)]);
export const workspaceSessions=sqliteTable('workspace_sessions',{
 tokenHash:text('token_hash').primaryKey(),spaceId:text('space_id').notNull(),generation:integer('generation').notNull(),expiresAt:integer('expires_at').notNull(),
});
export const workspaceAccounts=sqliteTable('workspace_accounts',{
 accountId:text('account_id').primaryKey(),spaceId:text('space_id').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('idx_workspace_accounts_space').on(t.spaceId)]);
export const workspaceMutations=sqliteTable('workspace_mutations',{
 userId:text('user_id').notNull(),mutationId:text('mutation_id').notNull(),requestHash:text('request_hash').notNull(),result:text('result').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.userId,t.mutationId]})]);
export const workspaceRates=sqliteTable('workspace_rates',{
 bucket:text('bucket').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull(),
});
