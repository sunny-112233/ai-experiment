# Build the initial PostgreSQL SQL from the unchanged SQLite migration inventory.
# Types mirror db/schema.postgres.ts. No production database is consulted.
import sqlite3,pathlib
r=pathlib.Path(__file__).resolve().parent.parent;c=sqlite3.connect(':memory:')
for f in sorted((r/'drizzle').glob('*.sql')):c.executescript(f.read_text())
parts=[];order=['participants','participant_codes','material_versions','material_state','task_starts','responses','backup_guard','backup_runs']
large={'started_ms','locked_until_ms','last_success_ms','size_bytes','response_time_ms','server_elapsed_ms','animation_duration_ms','training_duration_ms','time_limit_ms'}
for t in order:
 cols=c.execute('pragma table_info('+t+')').fetchall();lines=[];pk=[x[1]for x in sorted(cols,key=lambda x:x[5])if x[5]]
 if t=='participants':lines.append('"rowid" bigserial NOT NULL UNIQUE')
 for _,n,ty,req,default,is_pk in cols:
  typ='bigserial' if t=='participant_codes'and n=='number'else 'bigint' if n in large else 'integer' if ty.upper()=='INTEGER'else 'text'
  col='"'+n+'" '+typ
  if req or is_pk:col+=' NOT NULL'
  if len(pk)==1 and is_pk:col+=' PRIMARY KEY'
  if default is not None:col+=' DEFAULT '+default
  lines.append(col)
 if len(pk)>1:lines.append('PRIMARY KEY ('+','.join('"'+n+'"'for n in pk)+')')
 for fk in c.execute('pragma foreign_key_list('+t+')'):lines.append('FOREIGN KEY ("'+fk[3]+'") REFERENCES "'+fk[2]+'"("'+fk[4]+'")')
 if t=='participant_codes':lines.append('UNIQUE (participant_id)')
 parts.append('CREATE TABLE "'+t+'" (\n  '+',\n  '.join(lines)+'\n);')
parts+=['CREATE INDEX participants_allocation_idx ON participants(mode,recruitment_batch,study,questionnaire_version);','CREATE INDEX participants_started_idx ON participants(started_at);']
(r/'drizzle-postgres').mkdir(exist_ok=True);(r/'drizzle-postgres/0000_initial.sql').write_text('\n\n'.join(parts)+'\n')
