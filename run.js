/**
 * Fluentiq Unified Runner
 * Starts both Express Backend (port 3001) and Vite React Frontend (port 3000)
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('========================================================');
console.log('   🚀 Launching Fluentiq English Mastery Platform');
console.log('   - Frontend: http://localhost:3000');
console.log('   - Backend:  http://localhost:3001');
console.log('========================================================\n');

// 1. Start Server
const serverProc = spawn(npmCmd, ['start'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  shell: true
});

// 2. Start Client
const clientProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  serverProc.kill();
  clientProc.kill();
  process.exit();
});
