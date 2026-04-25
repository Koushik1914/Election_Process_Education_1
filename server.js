const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');
require('dotenv').config();

const aiService = require('./services/ai_service');
const visionService = require('./services/vision_service');
const speechService = require('./services/speech_service');
const pipeline = require('./logic/pipeline');

const app = express();
const port = process.env.PORT || 3000;

// Simple Memory Cache (5m TTL, max 100 entries)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 100 });

// Rate Limiting (60s window, max 20 requests)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer for file uploads (Limit 5MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, MP3, WAV, OGG, and WEBM are allowed.'));
        }
    }
});

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes

// 1. Verify Text
app.post('/verify/text', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text input is required.' });
    }

    try {
        const normalized = text.trim().toLowerCase();
        if (cache.has(normalized)) {
            return res.json(cache.get(normalized));
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

    try {
        const ocrResult = await visionService.extractText(req.file.buffer);
        if (ocrResult.error) {
            return res.status(400).json(ocrResult);
        }

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

    try {
        const transcript = await speechService.transcribe(req.file.buffer);
        if (transcript.error) {
            return res.status(400).json(transcript);
        }

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
    try {
        const result = await pipeline.getGuide(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Unable to provide guidance right now.' });
    }
});

// 5. Learn
app.post('/learn', async (req, res) => {
    const { topic } = req.body;
    try {
        const result = await pipeline.getEducation(topic);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Learning module unavailable.' });
    }
});

app.listen(port, () => {
    console.log(`JanVoice AI Server running at http://localhost:${port}`);
});
