'use strict';

const { VertexAI } = require('@google-cloud/vertexai');

/**
 * JanVoice AI — Vertex AI Service
 * Interfaces with Gemini 1.5 Flash for intent analysis, claim extraction, and fact-checking.
 */

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = 'us-central1';
const MODEL_NAME = 'gemini-1.5-flash';

const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });

const generativeModel = vertexAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
    },
});

/**
 * Safely parse JSON from AI model response, handling markdown blocks.
 * @param {string} text - Raw text from AI model
 * @returns {object|null} Parsed JSON or null
 */
function safeJSONParse(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        const clean = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(clean);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Extract text from Vertex AI response object.
 * @param {object} result - Vertex AI result
 * @returns {string} Extracted text
 */
function getText(result) {
    try {
        return result.response.candidates[0].content.parts[0].text || '';
    } catch {
        return '';
    }
}

/**
 * Normalize text by lowercasing and removing common filler words.
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalize(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/\?/g, '')
        .replace(/\b(anta|ah|na)\b/gi, '')
        .trim();
}

/**
 * Log structured error to stdout.
 * @param {string} context - Error context (function name)
 * @param {Error} error - Error object
 * @param {object} metadata - Optional metadata
 */
function logError(context, error, metadata = {}) {
    process.stdout.write(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'ERROR',
        context,
        message: error.message,
        ...metadata
    }) + '\n');
}

/**
 * Analyze user message for tone, intent, and language.
 * @param {string} message - User input message
 * @returns {Promise<object>} Analysis result
 */
async function analyzeMessage(message) {
    const prompt = `
Analyze this election-related message.

RULES:
- If election-related → VERIFY
- If "anta", "viral", "true?" → VERIFY
- Detect Tanglish
- Never return UNKNOWN for election content

Message: "${message}"

Return JSON:
{ "tone": "...", "intent": "...", "language": "..." }
`;

    try {
        const result = await generativeModel.generateContent(prompt);
        const text = getText(result);
        const data = safeJSONParse(text);

        return data || { tone: 'practical', intent: 'VERIFY', language: 'English' };
    } catch (e) {
        logError('analyzeMessage', e, { messageLength: message.length });
        return { tone: 'practical', intent: 'VERIFY', language: 'English' };
    }
}

/**
 * Extract a single election claim from user input.
 * @param {string} message - User input message
 * @returns {Promise<object>} Extracted claim details
 */
async function extractClaim(message) {
    const prompt = `
Extract ONE election claim.

RULES:
- Convert questions → claims
- Handle Tanglish
- NEVER reject election-related input

Examples:
"EVMs are hacked?" → "EVMs are hacked"
"Is EVM safe?" → "EVMs are unsafe"
"EVM hack ayindi anta?" → "EVMs are hacked"

Message: "${message}"

Return JSON:
{ "claim": "...", "language": "...", "confidence": 0-1 }
`;

    try {
        const result = await generativeModel.generateContent(prompt);
        const text = getText(result);
        const data = safeJSONParse(text);

        if (!data || !data.claim) {
            return {
                claim: normalize(message),
                language: 'mixed',
                confidence: 0.5
            };
        }

        return data;

    } catch (e) {
        logError('extractClaim', e, { messageLength: message.length });
        return {
            claim: normalize(message),
            language: 'mixed',
            confidence: 0.5
        };
    }
}

/**
 * Verify an election claim using Gemini's knowledge grounded in ECI data.
 * @param {string} claim - The claim to verify
 * @param {string} language - The language of the claim
 * @returns {Promise<object>} Verification result
 */
async function verifyClaim(claim, language) {
    const cleanClaim = normalize(claim);

    const prompt = `
Fact-check this claim using official ECI data.

Claim: "${cleanClaim}"
Language: "${language}"

Return JSON:
{
 "verdict": "TRUE | FALSE | MISLEADING | UNVERIFIABLE",
 "confidence": 0-100,
 "claim": "...",
 "fact": "...",
 "source": "...",
 "source_url": "...",
 "explanation": "...",
 "spread_reason": "...",
 "action": "..."
}
`;

    try {
        const result = await generativeModel.generateContent(prompt);
        const text = getText(result);
        const data = safeJSONParse(text);

        if (!data) {
            throw new Error('Invalid JSON from model');
        }

        // CONFIDENCE SAFETY
        if (data.confidence < 60) {
            return {
                verdict: 'UNVERIFIABLE',
                confidence: data.confidence || 0,
                claim: cleanClaim,
                fact: 'Could not verify using official sources.',
                source: 'ECI',
                source_url: 'https://eci.gov.in',
                explanation: 'Information is insufficient or unclear.',
                spread_reason: 'Unverified claims spread easily.',
                action: 'Check official sources.'
            };
        }

        return data;

    } catch (e) {
        logError('verifyClaim', e, { claimLength: cleanClaim.length });

        return {
            verdict: 'UNVERIFIABLE',
            confidence: 0,
            claim: cleanClaim,
            fact: 'System could not verify the claim.',
            source: 'ECI',
            source_url: 'https://eci.gov.in',
            explanation: 'Temporary issue while verifying.',
            spread_reason: 'Technical limitation.',
            action: 'Try again later.'
        };
    }
}

module.exports = {
    analyzeMessage,
    extractClaim,
    verifyClaim,
    generativeModel,
    safeJSONParse
};