const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
require('dotenv').config();

const pipeline = require('./logic/pipeline');

// Conditionally load services (graceful degradation in test env)
let aiService, visionService, speechService;
try {
    aiService = require('./services/ai_service');
    visionService = require('./services/vision_service');
    speechService = require('./services/speech_service');
} catch (e) {
    console.warn('Some services not available:', e.message);
}

const app = express();
const port = process.env.PORT || 3000;

// ─── Cache (5m TTL, max 100 entries) ────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 100 });

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});

// ─── Core Middleware ─────────────────────────────────────────────────────────
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Security Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com"
    );
    next();
});

app.use(express.static('public'));

// ─── Multer (memory storage, 5 MB limit) ────────────────────────────────────
const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, MP3, WAV, OGG, and WEBM allowed.'));
        }
    }
});

// ─── Request Logger ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ─── Input Validators ────────────────────────────────────────────────────────
function validateText(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= 2000;
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// 1. Verify Text
app.post('/verify/text', async (req, res) => {
    const { text } = req.body;

    if (!validateText(text)) {
        return res.status(400).json({ error: 'Valid text input (1–2000 chars) is required.' });
    }

    try {
        const normalized = text.trim().toLowerCase();
        if (cache.has(normalized)) {
            return res.json({ ...cache.get(normalized), cached: true });
        }

        const result = await pipeline.processText(text);
        cache.set(normalized, result);
        res.json(result);
    } catch (error) {
        console.error('Error in /verify/text:', error);
        res.status(500).json({ error: 'Unable to verify right now. Please try again.' });
    }
});

// 2. Verify Image (OCR)
app.post('/verify/image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Image file is required.' });
    }
    if (!visionService) {
        return res.status(503).json({ error: 'Vision service not available.' });
    }

    try {
        const ocrResult = await visionService.extractText(req.file.buffer);
        if (ocrResult.error) return res.status(400).json(ocrResult);

        const result = await pipeline.processText(ocrResult.text);
        res.json(result);
    } catch (error) {
        console.error('Error in /verify/image:', error);
        res.status(500).json({ error: 'Vision API failure. Please type your message.' });
    }
});

// 3. Verify Audio (STT)
app.post('/verify/audio', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required.' });
    }
    if (!speechService) {
        return res.status(503).json({ error: 'Speech service not available.' });
    }

    try {
        const transcript = await speechService.transcribe(req.file.buffer);
        if (transcript.error) return res.status(400).json(transcript);

        const result = await pipeline.processText(transcript.text);
        res.json(result);
    } catch (error) {
        console.error('Error in /verify/audio:', error);
        res.status(500).json({ error: 'Speech API failure. Please try again or type.' });
    }
});

// 4. Guide
app.post('/guide', async (req, res) => {
    const { query } = req.body;
    if (!validateText(query)) {
        return res.status(400).json({ error: 'A valid query is required.' });
    }

    try {
        const result = await pipeline.getGuide(query);
        res.json(result);
    } catch (error) {
        console.error('Error in /guide:', error);
        res.status(500).json({ error: 'Unable to provide guidance right now.' });
    }
});

// 5. Learn
app.post('/learn', async (req, res) => {
    const { topic } = req.body;
    if (!validateText(topic)) {
        return res.status(400).json({ error: 'A valid topic is required.' });
    }

    try {
        const result = await pipeline.getEducation(topic);
        res.json(result);
    } catch (error) {
        console.error('Error in /learn:', error);
        res.status(500).json({ error: 'Learning module unavailable.' });
    }
});

// ─── 404 & Global Error Handler ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
if (require.main === module) {
    app.listen(port, () => {
        console.log(`✅ JanVoice AI Server running at http://localhost:${port}`);
    });
}

module.exports = app;
