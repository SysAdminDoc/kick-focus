import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [metadata, core, runtime] = await Promise.all([
  readFile(resolve(root, 'src/metadata.txt'), 'utf8'),
  readFile(resolve(root, 'src/core.mjs'), 'utf8'),
  readFile(resolve(root, 'src/runtime.js'), 'utf8'),
]);

const bundledCore = core.replace(/^export\s+/gm, '');
const output = `${metadata.replaceAll('__VERSION__', VERSION)}(() => {\n'use strict';\n${bundledCore}\n${runtime}\n})();\n`;
const destination = resolve(root, 'dist/kick-focus.user.js');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, output, 'utf8');
console.log(`Built ${destination}`);
