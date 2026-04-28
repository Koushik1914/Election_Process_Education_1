'use strict';

jest.mock('./services/ai_service', () => ({
    analyzeMessage: jest.fn().mockResolvedValue({ intent: 'VERIFY', language: 'en' }),
    extractClaim: jest.fn().mockResolvedValue({ claim: 'EVMs are hacked', language: 'en', confidence: 0.9 }),
    verifyClaim: jest.fn().mockResolvedValue({
        verdict: 'FALSE', confidence: 99, claim: 'EVMs are hacked',
        fact: 'EVMs have no network connectivity.', source: 'ECI',
        source_url: 'https://www.eci.gov.in/evm/',
        explanation: 'EVMs cannot be remotely hacked.',
        spread_reason: 'Misinformation.', action: 'Visit eci.gov.in'
    }),
    generativeModel: {
        generateContent: jest.fn().mockResolvedValue({
            response: { candidates: [{ content: { parts: [{ text: 'Mocked AI response.' }] } }] }
        })
    }
}), { virtual: true });

jest.mock('./services/vision_service', () => ({
    extractText: jest.fn().mockResolvedValue({ text: 'EVM hack ayindi anta?' })
}), { virtual: true });

jest.mock('./services/speech_service', () => ({
    transcribe: jest.fn().mockResolvedValue({ text: 'How do I vote?' })
}), { virtual: true });

const request = require('supertest');
const app = require('./server');

describe('GET /health', () => {
    test('200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('timestamp');
    });
});

describe('Security headers', () => {
    let res;
    beforeAll(async () => { res = await request(app).get('/health'); });
    test('X-Content-Type-Options: nosniff', () => { expect(res.headers['x-content-type-options']).toBe('nosniff'); });
    test('X-Frame-Options: DENY', () => { expect(res.headers['x-frame-options']).toBe('DENY'); });
    test('X-XSS-Protection set', () => { expect(res.headers['x-xss-protection']).toBeTruthy(); });
    test('Content-Security-Policy set', () => { expect(res.headers['content-security-policy']).toContain("default-src 'self'"); });
    test('Referrer-Policy set', () => { expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin'); });
    test('Permissions-Policy set', () => { expect(res.headers['permissions-policy']).toContain('microphone=()'); });
    test('X-XSS-Protection: 1; mode=block', () => { expect(res.headers['x-xss-protection']).toBe('1; mode=block'); });
});

describe('POST /verify/text — valid', () => {
    test('EVM claim returns 200 with verdict', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM hack ayindi anta?' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('verdict');
        expect(res.body).toHaveProperty('response');
    });
    test('EVM hack returns FALSE verdict', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVMs are rigged and hacked' });
        expect(res.body.verdict).toBe('FALSE');
    });
    test('Returns shareable card', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM hack fraud' });
        expect(typeof res.body.card).toBe('string');
        expect(res.body.card.length).toBeGreaterThan(20);
    });
    test('Greeting returns GREETING intent', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'Hello' });
        expect(res.body.intent).toBe('GREETING');
    });
    test('Namaste returns GREETING intent', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'Namaste' });
        expect(res.body.intent).toBe('GREETING');
    });
    test('Vanakkam returns GREETING intent', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'Vanakkam' });
        expect(res.body.intent).toBe('GREETING');
    });
    test('Telugu transliterated input works', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM hack ayindi anta, nijamena?' });
        expect(res.statusCode).toBe(200);
    });
    test('Hindi input works', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM hack ho sakta hai kya?' });
        expect(res.statusCode).toBe(200);
    });
    test('Response content-type is JSON', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM hack' });
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
});

describe('POST /verify/image', () => {
    test('Upload image returns 200 with verification', async () => {
        const res = await request(app)
            .post('/verify/image')
            .attach('image', Buffer.from('fake-image-data'), { filename: 'test.png', contentType: 'image/png' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('verdict');
    });
    test('Missing file returns 400', async () => {
        const res = await request(app).post('/verify/image');
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /verify/audio', () => {
    test('Upload audio returns 200 with verification', async () => {
        const res = await request(app)
            .post('/verify/audio')
            .attach('audio', Buffer.from('fake-audio-data'), { filename: 'test.webm', contentType: 'audio/webm' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('verdict');
    });
    test('Missing file returns 400', async () => {
        const res = await request(app).post('/verify/audio');
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /verify/text — invalid / edge cases', () => {
    test('Missing text -> 400', async () => {
        const res = await request(app).post('/verify/text').send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
    test('Empty string -> 400', async () => {
        const res = await request(app).post('/verify/text').send({ text: '   ' });
        expect(res.statusCode).toBe(400);
    });
    test('Text over 2000 chars -> 400', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'a'.repeat(2001) });
        expect(res.statusCode).toBe(400);
    });
    test('Non-string text -> 400', async () => {
        const res = await request(app).post('/verify/text').send({ text: 12345 });
        expect(res.statusCode).toBe(400);
    });
    test('XSS payload sanitized', async () => {
        const res = await request(app).post('/verify/text').send({ text: '<script>alert("xss")</script> EVM hack' });
        expect(res.statusCode).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain('<script>');
    });
    test('Null byte input sanitized', async () => {
        const res = await request(app).post('/verify/text').send({ text: 'EVM\x00hack' });
        expect(res.statusCode).toBe(200);
    });
});

describe('POST /guide', () => {
    test('Valid query returns 200', async () => {
        const res = await request(app).post('/guide').send({ query: 'how to vote in India' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });
    test('Booth query returns GUIDE intent', async () => {
        const res = await request(app).post('/guide').send({ query: 'where is my polling booth?' });
        expect(res.body.intent).toBe('GUIDE');
    });
    test('Telugu guide query works', async () => {
        const res = await request(app).post('/guide').send({ query: 'Voting booth ekkada undi?' });
        expect(res.statusCode).toBe(200);
    });
    test('Missing query -> 400', async () => {
        const res = await request(app).post('/guide').send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('POST /learn', () => {
    test('Valid topic returns 200 with LEARN intent', async () => {
        const res = await request(app).post('/learn').send({ topic: 'What is ECI?' });
        expect(res.statusCode).toBe(200);
        expect(res.body.intent).toBe('LEARN');
    });
    test('Missing topic -> 400', async () => {
        const res = await request(app).post('/learn').send({});
        expect(res.statusCode).toBe(400);
    });
});

describe('Unknown routes', () => {
    test('GET /nonexistent -> 404', async () => {
        const res = await request(app).get('/nonexistent');
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });
    test('POST /unknown -> 404', async () => {
        const res = await request(app).post('/unknown').send({ foo: 'bar' });
        expect(res.statusCode).toBe(404);
    });
});

describe('Pipeline unit tests', () => {
    const { processText, getGuide, getEducation } = require('./logic/pipeline');

    test('hello -> GREETING', async () => { expect((await processText('hello')).intent).toBe('GREETING'); });
    test('Namaste -> GREETING', async () => { expect((await processText('Namaste')).intent).toBe('GREETING'); });
    test('Vanakkam -> GREETING', async () => { expect((await processText('Vanakkam')).intent).toBe('GREETING'); });
    test('EVM hack -> verdict FALSE', async () => { expect((await processText('EVMs are hacked and rigged')).verdict).toBe('FALSE'); });
    test('how to vote -> GUIDE', async () => { expect((await processText('How to vote in India?')).intent).toBe('GUIDE'); });
    test('where is booth -> GUIDE', async () => { expect((await processText('where is my booth?')).intent).toBe('GUIDE'); });
    test('I am scared -> VENT', async () => { expect((await processText('I am scared of voting fraud')).intent).toBe('VENT'); });

    test('getGuide() returns response + GUIDE intent', async () => {
        const r = await getGuide('how do i vote');
        expect(typeof r.response).toBe('string');
        expect(r.response.length).toBeGreaterThan(10);
        expect(r.intent).toBe('GUIDE');
    });

    test('getEducation() returns response + LEARN intent', async () => {
        const r = await getEducation('what is NOTA?');
        expect(typeof r.response).toBe('string');
        expect(r.intent).toBe('LEARN');
    });

    test('All inputs return non-empty response', async () => {
        for (const input of ['hello', 'EVM hack', 'how to vote', 'where is booth']) {
            const r = await processText(input);
            expect(r.response.trim().length).toBeGreaterThan(0);
        }
    });

    test('All inputs return intent field', async () => {
        for (const input of ['hello', 'EVM rigged', 'how to vote', 'I am scared']) {
            expect(await processText(input)).toHaveProperty('intent');
        }
    });
});