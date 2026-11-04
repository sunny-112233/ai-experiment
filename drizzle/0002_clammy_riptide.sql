CREATE TABLE `material_state` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`revision` integer NOT NULL,
	`active_version` text,
	`published_revision` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_versions` (
	`version_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`published_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `responses` ADD `primary_outcome` integer;