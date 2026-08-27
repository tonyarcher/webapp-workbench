import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const assets = readdirSync(join(dist, 'assets')).sort().join(',');
const version = createHash('sha1').update(assets).digest('hex').slice(0, 10);

const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const stamped = sw.replace(/const VERSION = '[^']*'/, `const VERSION = 'cal-${version}'`);
writeFileSync(swPath, stamped);
