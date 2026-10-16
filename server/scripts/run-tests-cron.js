/**
 * Automated Recurring Test Runner (Hourly Cron)
 * Runs all 4 test suites (47+ tests) periodically (default: every 60 minutes)
 * and records structured execution logs into server/data/test-results.log.
 *
 * Usage:
 *   node scripts/run-tests-cron.js           # Runs continuously every 60 minutes
 *   node scripts/run-tests-cron.js --once    # Runs once and exits with code 0 or 1
 *   node scripts/run-tests-cron.js --interval=30 # Runs every 30 minutes
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'test-results.log');
const args = process.argv.slice(2);
const runOnce = args.includes('--once');

// Parse interval in minutes
let intervalMinutes = 60;
const intervalArg = args.find(a => a.startsWith('--interval='));
if (intervalArg) {
  const parsed = parseInt(intervalArg.split('=')[1], 10);
  if (!isNaN(parsed) && parsed > 0) intervalMinutes = parsed;
}

function runTestSuite() {
  const startTime = new Date();
  console.log(`\n======================================================`);
  console.log(`  🕒 [${startTime.toISOString()}] Starting Automated Test Suite`);
  console.log(`======================================================`);

  exec('node --test tests/*.test.js', { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
    const endTime = new Date();
    const durationMs = endTime - startTime;

    const passMatch = stdout.match(/# pass\s+(\d+)/);
    const failMatch = stdout.match(/# fail\s+(\d+)/);
    const totalMatch = stdout.match(/# tests\s+(\d+)/);

    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;

    const status = failed === 0 && !error ? 'SUCCESS' : 'FAILED';
    const logEntry = `[${startTime.toISOString()}] Status: ${status} | Total: ${total} | Passed: ${passed} | Failed: ${failed} | Duration: ${durationMs}ms\n`;

    try {
      fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    } catch (err) {
      console.warn('Could not write to test log file:', err.message);
    }

    if (status === 'SUCCESS') {
      console.log(`  ✅ All ${passed} tests PASSED in ${durationMs}ms!`);
      console.log(`  📋 Results appended to: ${LOG_FILE}`);
    } else {
      console.error(`  ❌ Test suite FAILED (${failed} failed tests out of ${total})`);
      console.error(stderr || stdout);
    }
    console.log(`======================================================\n`);

    if (runOnce) {
      process.exit(status === 'SUCCESS' ? 0 : 1);
    } else {
      console.log(`⏳ Next automated test execution scheduled in ${intervalMinutes} minutes...`);
    }
  });
}

// Initial run
runTestSuite();

// Schedule recurring executions
if (!runOnce) {
  setInterval(runTestSuite, intervalMinutes * 60 * 1000);
}
