CREATE TABLE `backup_guard` (
	`id` text PRIMARY KEY NOT NULL,
	`locked_until_ms` integer NOT NULL,
	`last_success_ms` integer
);
--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	`size_bytes` integer,
	`sha256` text,
	`counts_json` text,
	`error` text
);
