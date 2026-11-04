import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const participants = sqliteTable('participants', {
 participantId:text('participant_id').primaryKey(),tokenHash:text('token_hash').notNull(),study:integer('study').notNull(),
 trainingDomain:text('training_domain').notNull(),trainingType:text('training_type').notNull(),questionnaireVersion:text('questionnaire_version').notNull(),materialKey:text('material_key').notNull(),
 timePressure:text('time_pressure').notNull(),timeLimit:integer('time_limit_ms'),materialVersion:text('material_version').notNull(),batch:text('recruitment_batch').notNull(),mode:text('mode').notNull(),
 startedAt:text('started_at').notNull(),trainingDuration:integer('training_duration_ms'),demographics:text('demographics'),knowledgeQuiz:text('knowledge_quiz'),completedAt:text('completed_at'),status:text('completion_status').notNull()
},t=>[index('participants_allocation_idx').on(t.mode,t.batch,t.study,t.questionnaireVersion),index('participants_started_idx').on(t.startedAt)]);
export const responses=sqliteTable('responses',{
 participantId:text('participant_id').notNull().references(()=>participants.participantId),taskId:text('task_id').notNull(),sourceQuestionNo:integer('source_question_no').notNull(),taskDomain:text('task_domain').notNull(),
 taskPosition:integer('task_position').notNull(),scenario:text('scenario').notNull(),aiAdvice:text('ai_advice').notNull(),adviceCorrectness:text('advice_correctness'),primaryOutcome:integer('primary_outcome'),adoptionScore:integer('adoption_score'),
 responseTime:integer('response_time_ms').notNull(),serverElapsed:integer('server_elapsed_ms').notNull(),timeout:integer('timeout').notNull(),missing:integer('missing').notNull(),taskPresentedAt:text('task_presented_at').notNull(),
 adviceFullyVisibleAt:text('advice_fully_visible_at'),clientSubmittedAt:text('client_submitted_at').notNull(),savedAt:text('server_saved_at').notNull(),animationDuration:integer('animation_duration_ms').notNull()
}, t=>[primaryKey({columns:[t.participantId,t.taskId]})]);
export const taskStarts=sqliteTable('task_starts',{participantId:text('participant_id').notNull().references(()=>participants.participantId),taskId:text('task_id').notNull(),startedMs:integer('started_ms').notNull()},t=>[primaryKey({columns:[t.participantId,t.taskId]})]);
export const participantCodes=sqliteTable('participant_codes',{number:integer('number').primaryKey({autoIncrement:true}),participantId:text('participant_id').notNull().unique()});
export const materialVersions=sqliteTable('material_versions',{versionId:text('version_id').primaryKey(),payload:text('payload').notNull(),publishedAt:text('published_at').notNull()});
export const materialState=sqliteTable('material_state',{id:text('id').primaryKey(),draft:text('draft').notNull(),revision:integer('revision').notNull(),activeVersion:text('active_version'),publishedRevision:integer('published_revision'),updatedAt:text('updated_at').notNull()});
export const backupRuns=sqliteTable('backup_runs',{id:text('id').primaryKey(),objectKey:text('object_key'),trigger:text('trigger').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),completedAt:text('completed_at'),sizeBytes:integer('size_bytes'),sha256:text('sha256'),counts:text('counts_json'),error:text('error')});
export const backupGuard=sqliteTable('backup_guard',{id:text('id').primaryKey(),lockedUntil:integer('locked_until_ms').notNull(),lastSuccess:integer('last_success_ms')});
