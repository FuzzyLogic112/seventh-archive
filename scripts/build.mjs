import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await build({ entryPoints: ['src/room.js'], outfile: 'dist/room.bundle.js', bundle: true, format: 'iife', target: ['es2020'], minify: true, legalComments: 'eof' });
await copyFile('node_modules/three/LICENSE', 'dist/vendor/THREE-LICENSE.txt');
console.log('3D room bundled locally. No CDN requests are needed.');
