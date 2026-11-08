import {defineConfig} from 'drizzle-kit';
export default defineConfig({dialect:'postgresql',schema:'./db/schema.postgres.ts',out:'./drizzle-postgres',dbCredentials:{url:process.env.DATABASE_MIGRATION_URL||process.env.DATABASE_URL||''}});
