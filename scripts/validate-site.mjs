import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

// Regression guard for the GitHub Pages subdirectory and stale module problem.
for(const entry of ['index.html','community.html']){
 const html=await readFile(`dist/${entry}`,'utf8');
 assert.match(html,/Content-Security-Policy/,'Keep the existing browser security policy');
 const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(scripts.length,'A built entry needs its runtime');
 for(const src of scripts)assert.match(src,/^\.\/assets\/.+-[\w-]+\.js$/,'Runtime scripts must be content hashed and relative');
 for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(/^(?:https?:|data:|#)/.test(url))continue;
  assert.ok(!url.startsWith('/'),'Absolute asset paths break project Pages sites');
  const relative=url.split(/[?#]/)[0];
  if(relative)await access(path.join('dist',relative));
 }
}
console.log('Both public entries use hashed relative scripts and existing local assets.');
