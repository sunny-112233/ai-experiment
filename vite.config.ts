import {defineConfig} from 'vite';
import vinext from 'vinext';
import {nitro} from 'nitro/vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'#runtime':fileURLToPath(new URL('./lib/runtime/vercel.ts',import.meta.url))}},
 plugins:[vinext(),nitro({noExternals:[/^@aws-sdk\//,/^@smithy\//,'pg','pg-pool','pg-protocol','pg-types','pgpass','pg-connection-string'],preset:process.env.NITRO_PRESET || 'vercel',vercel:{functions:{maxDuration:300}}})],
});
