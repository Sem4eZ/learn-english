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
const { getDictionary, toggleFavorite, generateDictionaryWords, recordSrsReview } = require('./controllers/dictionaryController');

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

// Health check
app.get('/api/health', (req, res) => {
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
app.post('/api/dictionary/review', recordSrsReview);
app.post('/api/dictionary/:id/favorite', toggleFavorite);

// User Progress & History
app.post('/api/progress/answer', recordAnswer);
app.get('/api/progress/stats', getStats);
app.get('/api/progress/history', getHistory);

// Start server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 Fluentiq API Server active on http://localhost:${PORT}`);
  console.log(`  📚 Native SQLite WAL & Spaced Repetition (SRS) Ready`);
  console.log(`======================================================\n`);
});

