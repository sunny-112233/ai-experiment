CREATE TABLE "participants" (
  "rowid" bigserial NOT NULL UNIQUE,
  "participant_id" text NOT NULL PRIMARY KEY,
  "token_hash" text NOT NULL,
  "study" integer NOT NULL,
  "training_domain" text NOT NULL,
  "training_type" text NOT NULL,
  "questionnaire_version" text NOT NULL,
  "material_key" text NOT NULL,
  "time_pressure" text NOT NULL,
  "time_limit_ms" bigint,
  "material_version" text NOT NULL,
  "recruitment_batch" text NOT NULL,
  "mode" text NOT NULL,
  "started_at" text NOT NULL,
  "training_duration_ms" bigint,
  "demographics" text,
  "knowledge_quiz" text,
  "completed_at" text,
  "completion_status" text NOT NULL
);

CREATE TABLE "participant_codes" (
  "number" bigserial NOT NULL PRIMARY KEY,
  "participant_id" text NOT NULL,
  UNIQUE (participant_id)
);

CREATE TABLE "material_versions" (
  "version_id" text NOT NULL PRIMARY KEY,
  "payload" text NOT NULL,
  "published_at" text NOT NULL
);

CREATE TABLE "material_state" (
  "id" text NOT NULL PRIMARY KEY,
  "draft" text NOT NULL,
  "revision" integer NOT NULL,
  "active_version" text,
  "published_revision" integer,
  "updated_at" text NOT NULL
);

CREATE TABLE "task_starts" (
  "participant_id" text NOT NULL,
  "task_id" text NOT NULL,
  "started_ms" bigint NOT NULL,
  PRIMARY KEY ("participant_id","task_id"),
  FOREIGN KEY ("participant_id") REFERENCES "participants"("participant_id")
);

CREATE TABLE "responses" (
  "participant_id" text NOT NULL,
  "task_id" text NOT NULL,
  "source_question_no" integer NOT NULL,
  "task_domain" text NOT NULL,
  "task_position" integer NOT NULL,
  "scenario" text NOT NULL,
  "ai_advice" text NOT NULL,
  "advice_correctness" text,
  "adoption_score" integer,
  "response_time_ms" bigint NOT NULL,
  "server_elapsed_ms" bigint NOT NULL,
  "timeout" integer NOT NULL,
  "missing" integer NOT NULL,
  "task_presented_at" text NOT NULL,
  "advice_fully_visible_at" text,
  "client_submitted_at" text NOT NULL,
  "server_saved_at" text NOT NULL,
  "animation_duration_ms" bigint NOT NULL,
  "primary_outcome" integer,
  PRIMARY KEY ("participant_id","task_id"),
  FOREIGN KEY ("participant_id") REFERENCES "participants"("participant_id")
);

CREATE TABLE "backup_guard" (
  "id" text NOT NULL PRIMARY KEY,
  "locked_until_ms" bigint NOT NULL,
  "last_success_ms" bigint
);

CREATE TABLE "backup_runs" (
  "id" text NOT NULL PRIMARY KEY,
  "object_key" text,
  "trigger" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL,
  "completed_at" text,
  "size_bytes" bigint,
  "sha256" text,
  "counts_json" text,
  "error" text
);

CREATE INDEX participants_allocation_idx ON participants(mode,recruitment_batch,study,questionnaire_version);

CREATE INDEX participants_started_idx ON participants(started_at);
