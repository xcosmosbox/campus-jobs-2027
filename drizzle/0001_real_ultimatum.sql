CREATE TABLE `workspace_accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_accounts_space` ON `workspace_accounts` (`space_id`);--> statement-breakpoint
CREATE TABLE `workspace_mutations` (
	`user_id` text NOT NULL,
	`mutation_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `mutation_id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_rates` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`generation` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_hash` text,
	`generation` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_spaces_recovery` ON `workspace_spaces` (`recovery_hash`);