/**
 * JanVoice AI — API Test Suite
 * ─────────────────────────────
 * Covers: /verify/text, /guide, /learn, /health
 * Runner: Jest + Supertest
 *
 * Run with: npm test
 */

'use strict';

const request = require('supertest');

// Mock AI services so tests run without real GCP credentials
jest.mock('./services/ai_service', () => ({
    analyzeMessage: jest.fn().mockResolvedValue({ intent: 'VERIFY', language: 'en' }),
    extractClaim: jest.fn().mockResolvedValue({ claim: 'EVMs are hacked', language: 'en', confidence: 0.9 }),
    verifyClaim: jest.fn().mockResolvedValue({
        verdict: 'FALSE',
        confidence: 99,
        claim: 'EVMs are hacked',
        fact: 'EVMs have no network connectivity.',
        source: 'ECI',
        source_url: 'https://www.eci.gov.in/evm/',
        explanation: 'EVMs cannot be remotely hacked.',
        spread_reason: 'Misinformation.',
        action: 'Visit eci.gov.in'
    }),
    safeJSONParse: jest.fn(),
    generativeModel: {
        generateContent: jest.fn().mockResolvedValue({
            response: {
                candidates: [{
                    content: { parts: [{ text: 'Mocked AI response for testing.' }] }
                }]
            }
        })
    }
}));

jest.mock('./services/vision_service', () => ({
    extractText: jest.fn().mockResolvedValue({ text: 'EVM hack ayindi anta?' })
}));

jest.mock('./services/speech_service', () => ({
    transcribe: jest.fn().mockResolvedValue({ text: 'How do I vote?' })
}));

const app = require('./server');

// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('timestamp');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// VERIFY TEXT ENDPOINT
// ════════════════════════════════════════════════════════════════════════════

describe('POST /verify/text', () => {
    test('returns 200 with verdict for EVM claim', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'EVM hack ayindi anta?' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
        expect(res.body).toHaveProperty('verdict');
    });

    test('returns FALSE verdict for EVM hack claim', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'EVMs are rigged and hacked' });

        expect(res.statusCode).toBe(200);
        expect(res.body.verdict).toBe('FALSE');
    });

    test('returns 400 when text is missing', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('returns 400 when text is empty string', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: '   ' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('returns 400 when text exceeds 2000 chars', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'a'.repeat(2001) });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('responds correctly to greeting', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'Hello' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('intent', 'GREETING');
    });

    test('response contains shareable card for election claims', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'EVM hack fraud rigged' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('card');
        expect(typeof res.body.card).toBe('string');
    });

    test('response has correct content-type header', async () => {
        const res = await request(app)
            .post('/verify/text')
            .send({ text: 'EVM hack ayindi' });

        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// GUIDE ENDPOINT
// ════════════════════════════════════════════════════════════════════════════

describe('POST /guide', () => {
    test('returns 200 for valid voting query', async () => {
        const res = await request(app)
            .post('/guide')
            .send({ query: 'how to vote in India' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });

    test('returns 200 for booth location query', async () => {
        const res = await request(app)
            .post('/guide')
            .send({ query: 'where is my polling booth?' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });

    test('returns 400 when query is missing', async () => {
        const res = await request(app)
            .post('/guide')
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('intent in response is GUIDE', async () => {
        const res = await request(app)
            .post('/guide')
            .send({ query: 'voting process' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('intent', 'GUIDE');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// LEARN ENDPOINT
// ════════════════════════════════════════════════════════════════════════════

describe('POST /learn', () => {
    test('returns 200 for valid topic', async () => {
        const res = await request(app)
            .post('/learn')
            .send({ topic: 'What is ECI?' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });

    test('returns 400 when topic is missing', async () => {
        const res = await request(app)
            .post('/learn')
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ════════════════════════════════════════════════════════════════════════════

describe('Security headers', () => {
    test('X-Content-Type-Options is nosniff', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('X-Frame-Options is DENY', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('X-XSS-Protection is set', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-xss-protection']).toBeTruthy();
    });
});

// ════════════════════════════════════════════════════════════════════════════
// 404 HANDLER
// ════════════════════════════════════════════════════════════════════════════

describe('404 handler', () => {
    test('returns 404 for unknown route', async () => {
        const res = await request(app).get('/nonexistent');
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// PIPELINE UNIT TESTS (no HTTP layer)
// ════════════════════════════════════════════════════════════════════════════

describe('Pipeline processText()', () => {
    const { processText } = require('./logic/pipeline');

    test('returns GREETING intent for hello', async () => {
        const result = await processText('hello');
        expect(result.intent).toBe('GREETING');
    });

    test('returns GREETING intent for namaste', async () => {
        const result = await processText('Namaste');
        expect(result.intent).toBe('GREETING');
    });

    test('returns response string for EVM claim', async () => {
        const result = await processText('EVM hack ayindi anta?');
        expect(typeof result.response).toBe('string');
        expect(result.response.length).toBeGreaterThan(10);
    });

    test('returns verdict FALSE for EVM hack claim', async () => {
        const result = await processText('EVMs are hacked and rigged');
        expect(result.verdict).toBe('FALSE');
    });

    test('returns GUIDE intent for voting query', async () => {
        const result = await processText('How to vote in India?');
        expect(result.intent).toBe('GUIDE');
    });

    test('response is always a non-empty string', async () => {
        const inputs = ['hello', 'EVM hack', 'how to vote', 'where is booth'];
        for (const input of inputs) {
            const result = await processText(input);
            expect(typeof result.response).toBe('string');
            expect(result.response.trim().length).toBeGreaterThan(0);
        }
    });
});
