import {spawn} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const child = process.platform === 'win32'
    ? spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', ['gradlew.bat', ...args].join(' ')],
        {cwd: root, stdio: 'inherit', windowsHide: true},
    )
    : spawn('./gradlew', args, {cwd: root, stdio: 'inherit'});
child.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
});
child.on('close', (code) => process.exit(code ?? 1));
