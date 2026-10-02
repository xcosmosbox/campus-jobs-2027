CREATE TABLE `workspace_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`summary` text NOT NULL,
	`changes` text NOT NULL,
	`source_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_events_user_time` ON `workspace_events` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `workspace_records` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`last_event_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`)
);
