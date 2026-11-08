#!/usr/bin/env bash
set -euo pipefail
: "${PG_BIN:?Set PG_BIN to a local PostgreSQL bin directory}"
pg_test_dir=$(mktemp -d /tmp/experiment-native-check.XXXXXX)
"$PG_BIN/initdb" -D "$pg_test_dir" -U experiment --auth=trust --no-locale -E UTF8 > /tmp/pg-local-init.log 2>&1
"$PG_BIN/postgres" -D "$pg_test_dir" -h 127.0.0.1 -p 55439 -c unix_socket_directories='' > /tmp/pg-local-server.log 2>&1 &
pg_test_pid=$!
trap 'kill "$pg_test_pid" 2>/dev/null || true' EXIT
node --input-type=module - <<'JS'
import {Client} from 'pg';for(let i=0;i<30;i++){const c=new Client({connectionString:'postgresql://experiment@127.0.0.1:55439/postgres'});try{await c.connect();await c.query('CREATE DATABASE experiment_vercel_test');await c.end();break}catch(e){await c.end().catch(()=>{});if(i===29)throw e;await new Promise(r=>setTimeout(r,100))}}
JS
export TEST_DATABASE_URL=postgresql://experiment@127.0.0.1:55439/experiment_vercel_test
export DATABASE_URL="$TEST_DATABASE_URL"
export ADMIN_TOKEN=test-only-token
npm run test:postgres
node scripts/test-built-vercel.mjs
node --import tsx scripts/test-volume.mjs
