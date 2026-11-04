CREATE TABLE `participant_codes` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_codes_participant_id_unique` ON `participant_codes` (`participant_id`);