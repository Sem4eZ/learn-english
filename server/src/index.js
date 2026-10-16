/**
 * Fluentiq Express API Server
 * Orchestrates pedagogical question generation, native SQLite data persistence,
 * user authentication, and spaced repetition system (SRS).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { register, login, getMe } = require('./controllers/authController');
const { getSections } = require('./controllers/sectionsController');
const { getQuestions, generateBatch } = require('./controllers/questionsController');
const { recordAnswer, getStats, getHistory } = require('./controllers/progressController');
const { 
  getDictionary, 
  toggleFavorite, 
  generateDictionaryWords, 
  recordSrsReview, 
  lookupWord 
} = require('./controllers/dictionaryController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Root redirect to live frontend
app.get('/', (req, res) => {
  res.redirect('https://sem4ez.github.io/learn-english/');
});

// Health check (supports Render /healthz and /api/health)
app.get(['/api/health', '/healthz'], (req, res) => {
  res.json({ status: 'ok', service: 'Fluentiq API', timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/me', getMe);

// Sections & Questions
app.get('/api/sections', getSections);
app.get('/api/questions', getQuestions);
app.post('/api/questions/generate', generateBatch);

// Dictionary & SRS
app.get('/api/dictionary', getDictionary);
app.post('/api/dictionary/generate', generateDictionaryWords);
app.post('/api/dictionary/lookup', lookupWord);
app.post('/api/dictionary/review', recordSrsReview);
app.post('/api/dictionary/:id/favorite', toggleFavorite);

// User Progress & History
app.post('/api/progress/answer', recordAnswer);
app.get('/api/progress/stats', getStats);
app.get('/api/progress/history', getHistory);

// Serve static client build if present (for fullstack production hosting)
const path = require('path');
const fs = require('fs');
const clientDist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const db = require('./db/schema');

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 Fluentiq API Server active on http://localhost:${PORT}`);
    console.log(`  💾 Database: ${db.isTurso ? '🌐 Turso Cloud libSQL (Persistent)' : '📁 Local SQLite WAL (node:sqlite)'}`);
    console.log(`  🧠 AI Engine: Google Gemini Flash-Lite & Fallback Pipeline`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;

