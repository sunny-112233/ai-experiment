import {spawnSync} from 'node:child_process';
process.env.NITRO_PRESET ||= 'vercel';
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exit(r.status??1);
