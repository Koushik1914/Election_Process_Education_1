'use strict';

/**
 * JanVoice AI — Express Server
 * Handles routing, security middleware, file uploads, and caching.
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
require('dotenv').config();

const pipeline = require('./logic/pipeline');

let visionService, speechService;
try { visionService = require('./services/vision_service'); } catch { /* not available */ }
try { speechService = require('./services/speech_service'); } catch { /* not available */ }

const app = express();
const port = process.env.PORT || 3000;

// Constants for configuration
const CACHE_TTL = 300;
const CACHE_CHECK = 60;
const CACHE_MAX = 100;
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 20;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 2000;

const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: CACHE_CHECK, maxKeys: CACHE_MAX });

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(o => o.trim()).filter(Boolean);

const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'
]);

app.use(rateLimit({
    windowMs: RATE_WINDOW,
    max: process.env.NODE_ENV === 'test' ? 1000 : RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a minute.' }
}));

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
            cb(null, true);
        } else {
            cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'microphone=(), camera=()');
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self';"
    );
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static('public'));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        ALLOWED_MIME.has(file.mimetype)
            ? cb(null, true)
            : cb(Object.assign(new Error('Invalid file type.'), { status: 400 }));
    }
});

app.use((req, _res, next) => {
    process.stdout.write(
        JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', method: req.method, url: req.url }) + '\n'
    );
    next();
});

/**
 * Sanitize and validate input text.
 * @param {any} value - The input text to sanitize
 * @returns {string|null} Sanitized string or null if invalid
 */
function sanitizeText(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) return null;
    return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.post('/verify/text', async (req, res) => {
    const text = sanitizeText(req.body.text);
    if (!text) {
        return res.status(400).json({ error: 'Valid text input (1-2000 chars) is required.' });
    }
    try {
        const key = text.toLowerCase();
        if (cache.has(key)) return res.json({ ...cache.get(key), cached: true });
        const result = await pipeline.processText(text);
        cache.set(key, result);
        res.json(result);
    } catch (err) {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', route: '/verify/text', error: err.message }) + '\n');
        res.status(500).json({ error: 'Unable to verify right now. Please try again.' });
    }
});

app.post('/verify/image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Image file is required.' });
    if (!visionService) return res.status(503).json({ error: 'Vision service not available.' });
    try {
        const ocr = await visionService.extractText(req.file.buffer);
        if (ocr.error) return res.status(400).json(ocr);
        res.json(await pipeline.processText(ocr.text));
    } catch (err) {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', route: '/verify/image', error: err.message }) + '\n');
        res.status(500).json({ error: 'Vision API failure. Please type your message.' });
    }
});

app.post('/verify/audio', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });
    if (!speechService) return res.status(503).json({ error: 'Speech service not available.' });
    try {
        const transcript = await speechService.transcribe(req.file.buffer);
        if (transcript.error) return res.status(400).json(transcript);
        res.json(await pipeline.processText(transcript.text));
    } catch (err) {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', route: '/verify/audio', error: err.message }) + '\n');
        res.status(500).json({ error: 'Speech API failure. Please try again or type.' });
    }
});

app.post('/guide', async (req, res) => {
    const query = sanitizeText(req.body.query);
    if (!query) return res.status(400).json({ error: 'A valid query is required.' });
    try {
        res.json(await pipeline.getGuide(query));
    } catch (err) {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', route: '/guide', error: err.message }) + '\n');
        res.status(500).json({ error: 'Unable to provide guidance right now.' });
    }
});

app.post('/learn', async (req, res) => {
    const topic = sanitizeText(req.body.topic);
    if (!topic) return res.status(400).json({ error: 'A valid topic is required.' });
    try {
        res.json(await pipeline.getEducation(topic));
    } catch (err) {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', route: '/learn', error: err.message }) + '\n');
        res.status(500).json({ error: 'Learning module unavailable.' });
    }
});

// Multer / CORS error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.status === 400) {
        return res.status(400).json({ error: err.message });
    }
    if (err.message?.startsWith('CORS')) {
        return res.status(403).json({ error: 'Origin not allowed.' });
    }
    next(err);
});

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

app.use((err, _req, res, _next) => {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'FATAL', error: err.stack }) + '\n');
    res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
    app.listen(port, () => {
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', msg: 'JanVoice AI started', port, env: process.env.NODE_ENV }) + '\n');
    });
}

module.exports = app;