/**
 * Run the host `gradle` for stock-game-api. Looks in GRADLE_HOME, ~/.local/opt/gradle-*,
 * then PATH so a shell opened before install-tools still works.
 */
import {spawn} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {delimiter, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bat = process.platform === 'win32' ? 'gradle.bat' : 'gradle';

function exeIn(dir) {
    if (!dir) return null;
    const path = join(dir, bat);
    return existsSync(path) ? path : null;
}

function fromOpt() {
    const opt = join(homedir(), '.local', 'opt');
    if (!existsSync(opt)) return null;
    const names = readdirSync(opt).filter((n) => n.startsWith('gradle-')).sort().reverse();
    for (const name of names) {
        const found = exeIn(join(opt, name, 'bin'));
        if (found) return found;
    }
    return null;
}

function fromPath() {
    for (const dir of (process.env.PATH || '').split(delimiter)) {
        const found = exeIn(dir);
        if (found) return found;
    }
    return null;
}

function resolveGradle() {
    return exeIn(process.env.GRADLE_HOME ? join(process.env.GRADLE_HOME, 'bin') : '')
        || fromOpt()
        || fromPath();
}

function quoteWin(path) {
    return path.includes(' ') ? `"${path}"` : path;
}

function run(exe, args) {
    const child = process.platform === 'win32'
        ? spawn(
            process.env.ComSpec || 'cmd.exe',
            ['/d', '/s', '/c', [quoteWin(exe), ...args].join(' ')],
            {cwd: root, stdio: 'inherit', windowsHide: true},
        )
        : spawn(exe, args, {cwd: root, stdio: 'inherit'});
    child.on('error', (err) => {
        console.error(err.message);
        process.exit(1);
    });
    child.on('close', (code) => process.exit(code ?? 1));
}

const exe = resolveGradle();
if (!exe) {
    console.error('error: gradle not found. Install with ops-scripts install-tools, then open a new shell.');
    process.exit(1);
}
run(exe, process.argv.slice(2));
