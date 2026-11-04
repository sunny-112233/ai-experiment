CREATE TABLE `participants` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`study` integer NOT NULL,
	`training_domain` text NOT NULL,
	`training_type` text NOT NULL,
	`questionnaire_version` text NOT NULL,
	`material_key` text NOT NULL,
	`time_pressure` text NOT NULL,
	`time_limit_ms` integer,
	`material_version` text NOT NULL,
	`recruitment_batch` text NOT NULL,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`training_duration_ms` integer,
	`demographics` text,
	`knowledge_quiz` text,
	`completed_at` text,
	`completion_status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`participant_id` text NOT NULL,
	`task_id` text NOT NULL,
	`source_question_no` integer NOT NULL,
	`task_domain` text NOT NULL,
	`task_position` integer NOT NULL,
	`scenario` text NOT NULL,
	`ai_advice` text NOT NULL,
	`advice_correctness` text,
	`adoption_score` integer,
	`response_time_ms` integer NOT NULL,
	`server_elapsed_ms` integer NOT NULL,
	`timeout` integer NOT NULL,
	`missing` integer NOT NULL,
	`task_presented_at` text NOT NULL,
	`advice_fully_visible_at` text,
	`client_submitted_at` text NOT NULL,
	`server_saved_at` text NOT NULL,
	`animation_duration_ms` integer NOT NULL,
	PRIMARY KEY(`participant_id`, `task_id`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`participant_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_starts` (
	`participant_id` text NOT NULL,
	`task_id` text NOT NULL,
	`started_ms` integer NOT NULL,
	PRIMARY KEY(`participant_id`, `task_id`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`participant_id`) ON UPDATE no action ON DELETE no action
);
