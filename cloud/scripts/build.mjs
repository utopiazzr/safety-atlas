import {build} from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built isolated intake Worker.');
