process.env.NODE_ENV = process.env.NODE_ENV || 'test';
/**
 * Global Test Setup
 * Instantly binds Express on port 3001 for test suites without async race conditions.
 */

const app = require('../src/index');
const PORT = 3001;

try {
  const server = app.listen(PORT, () => {
    server.unref();
  });
  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.warn('[TestSetup] Server bind warning:', err.message);
    }
  });
} catch (_) {}
