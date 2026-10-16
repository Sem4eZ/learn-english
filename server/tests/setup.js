/**
 * Global Test Setup
 * Automatically ensures the Express application is running before tests execute.
 */

const http = require('http');
const app = require('../src/index');

const PORT = 3001;

function checkPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
  const isRunning = await checkPortOpen(PORT);
  if (!isRunning) {
    try {
      const server = app.listen(PORT, () => {
        // Keep server open for test execution
      });
      server.unref(); // Allows node to exit when tests complete
    } catch (_) {}
  }
})();
