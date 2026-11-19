ALTER TABLE participants ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS ai_variables text;
CREATE INDEX IF NOT EXISTS participants_group_idx ON participants(recruitment_batch,group_id);
