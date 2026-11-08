import { pgTable, text, integer, bigint, bigserial, primaryKey, index } from 'drizzle-orm/pg-core';
export const participants = pgTable('participants', {
 rowid:bigserial('rowid',{mode:'number'}).notNull().unique(),participantId:text('participant_id').primaryKey(),tokenHash:text('token_hash').notNull(),study:integer('study').notNull(),
 trainingDomain:text('training_domain').notNull(),trainingType:text('training_type').notNull(),questionnaireVersion:text('questionnaire_version').notNull(),materialKey:text('material_key').notNull(),
 timePressure:text('time_pressure').notNull(),timeLimit:bigint('time_limit_ms',{mode:'number'}),materialVersion:text('material_version').notNull(),batch:text('recruitment_batch').notNull(),mode:text('mode').notNull(),
 startedAt:text('started_at').notNull(),trainingDuration:bigint('training_duration_ms',{mode:'number'}),demographics:text('demographics'),knowledgeQuiz:text('knowledge_quiz'),completedAt:text('completed_at'),status:text('completion_status').notNull()
},t=>[index('participants_allocation_idx').on(t.mode,t.batch,t.study,t.questionnaireVersion),index('participants_started_idx').on(t.startedAt)]);
export const responses=pgTable('responses',{
 participantId:text('participant_id').notNull().references(()=>participants.participantId),taskId:text('task_id').notNull(),sourceQuestionNo:integer('source_question_no').notNull(),taskDomain:text('task_domain').notNull(),
 taskPosition:integer('task_position').notNull(),scenario:text('scenario').notNull(),aiAdvice:text('ai_advice').notNull(),adviceCorrectness:text('advice_correctness'),primaryOutcome:integer('primary_outcome'),adoptionScore:integer('adoption_score'),
 responseTime:bigint('response_time_ms',{mode:'number'}).notNull(),serverElapsed:bigint('server_elapsed_ms',{mode:'number'}).notNull(),timeout:integer('timeout').notNull(),missing:integer('missing').notNull(),taskPresentedAt:text('task_presented_at').notNull(),
 adviceFullyVisibleAt:text('advice_fully_visible_at'),clientSubmittedAt:text('client_submitted_at').notNull(),savedAt:text('server_saved_at').notNull(),animationDuration:bigint('animation_duration_ms',{mode:'number'}).notNull()
}, t=>[primaryKey({columns:[t.participantId,t.taskId]})]);
export const taskStarts=pgTable('task_starts',{participantId:text('participant_id').notNull().references(()=>participants.participantId),taskId:text('task_id').notNull(),startedMs:bigint('started_ms',{mode:'number'}).notNull()},t=>[primaryKey({columns:[t.participantId,t.taskId]})]);
export const participantCodes=pgTable('participant_codes',{number:bigserial('number',{mode:'number'}).primaryKey(),participantId:text('participant_id').notNull().unique()});
export const materialVersions=pgTable('material_versions',{versionId:text('version_id').primaryKey(),payload:text('payload').notNull(),publishedAt:text('published_at').notNull()});
export const materialState=pgTable('material_state',{id:text('id').primaryKey(),draft:text('draft').notNull(),revision:integer('revision').notNull(),activeVersion:text('active_version'),publishedRevision:integer('published_revision'),updatedAt:text('updated_at').notNull()});
export const backupRuns=pgTable('backup_runs',{id:text('id').primaryKey(),objectKey:text('object_key'),trigger:text('trigger').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),completedAt:text('completed_at'),sizeBytes:bigint('size_bytes',{mode:'number'}),sha256:text('sha256'),counts:text('counts_json'),error:text('error')});
export const backupGuard=pgTable('backup_guard',{id:text('id').primaryKey(),lockedUntil:bigint('locked_until_ms',{mode:'number'}).notNull(),lastSuccess:bigint('last_success_ms',{mode:'number'})});
