'use strict';

/**
 * JanVoice AI — Main Processing Pipeline
 * ────────────────────────────────────────
 * Flow:
 *   1. Detect intent  → VERIFY | GUIDE | LEARN | VENT | GREETING
 *   2. Extract claim  → normalize + language detection
 *   3. Route          → dedicated handler per intent
 *   4. Format         → structured response + shareable card
 *
 * Designed for Indian voters: supports Telugu, Hindi, English, Tanglish.
 */

let aiService;
try {
    aiService = require('../services/ai_service');
} catch (e) {
    // Allow pipeline to be loaded in test environments without real AI service
    process.stdout.write(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'WARN',
        context: 'PipelineInit',
        message: 'AI service not available: ' + e.message
    }) + '\n');
    aiService = null;
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Strip common filler words and punctuation for claim normalization.
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeClaim(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[?!]/g, '')
        .replace(/\b(anta|ah|na|kda|ra|le|ga)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Detect simple greeting patterns across supported languages.
 * @param {string} text - Input text
 * @returns {boolean} True if text is a greeting
 */
function isGreeting(text) {
    return /^(hi|hello|hey|namaste|vanakkam|namaskar|hola)\b/i.test(text.trim());
}

/** Election-domain keywords (English + common Telugu/Hindi transliterations). */
const ELECTION_KEYWORDS = [
    'evm', 'vote', 'voting', 'election', 'booth', 'poll', 'eci',
    'candidate', 'ballot', 'hack', 'fraud', 'rigged', 'result',
    'matadanam', 'chunav', 'matadan', 'praja'
];

/**
 * Check whether the text relates to elections at all.
 * @param {string} text - Input text
 * @returns {boolean} True if election-related
 */
function mentionsElection(text) {
    const lower = text.toLowerCase();
    return ELECTION_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Detect guide/how-to queries in English, Telugu, and Hindi.
 * Matches: where, how to, vote, register, ekkada (Telugu for 'where'),
 *          kaha (Hindi for 'where'), process, booth location, etc.
 * @param {string} text - Input text
 * @returns {boolean} True if guide query
 */
function isGuideQuery(text) {
    const t = text.toLowerCase();
    return (
        t.includes('where') ||
        t.includes('ekkada') ||   // Telugu: where
        t.includes('kaha') ||     // Hindi: where
        t.includes('kahan') ||    // Hindi variant
        t.includes('how to vote') ||
        t.includes('how to') ||
        t.includes('process') ||
        t.includes('register') ||
        t.includes('booth') ||
        t.includes('polling')
    );
}

/**
 * Detect emotional/vent intent.
 * @param {string} text - Input text
 * @returns {boolean} True if vent query
 */
function isVentQuery(text) {
    const t = text.toLowerCase();
    return (
        t.includes('cheat') || t.includes('unfair') || t.includes('angry') ||
        t.includes('worried') || t.includes('scared') || t.includes('trust') ||
        t.includes('fear') || t.includes('betrayed')
    );
}

// ════════════════════════════════════════════════════════════════════════════
// PREDEFINED FACT DATABASE (Demo Reliability Layer)
// Ensures consistent, fast answers for the most common Indian election claims.
// ════════════════════════════════════════════════════════════════════════════

const PREDEFINED_FACTS = {
    evm: {
        verdict: 'FALSE',
        confidence: 99,
        claim: 'EVMs are hacked / rigged.',
        fact: 'Indian EVMs are standalone machines with no Wi-Fi, Bluetooth, or internet connectivity and cannot be hacked remotely.',
        source: 'Election Commission of India (ECI)',
        source_url: 'https://www.eci.gov.in/evm/',
        explanation:
            'EVMs store votes in a chip with no external communication port. The Supreme Court of India has repeatedly upheld their integrity after extensive technical scrutiny.',
        spread_reason: 'Fear and misunderstanding of EVM technology amplified by social media forwards.',
        action: 'Visit eci.gov.in/evm for official technical documentation and FAQs.'
    },
    voter_id: {
        verdict: 'TRUE',
        confidence: 95,
        claim: 'You need a valid ID to vote.',
        fact: 'Voters must carry one of 12 approved photo IDs (Voter ID card, Aadhaar, Passport, etc.).',
        source: 'Election Commission of India (ECI)',
        source_url: 'https://www.eci.gov.in',
        explanation:
            'The ECI accepts 12 alternative photo IDs if the Voter ID card is unavailable. EPIC (Voter ID card) is the primary document.',
        spread_reason: 'Confusion about which documents are accepted.',
        action: 'Carry your Voter ID or any government-issued photo ID on polling day.'
    }
};

/**
 * Safely extract text from a Vertex AI response object.
 * @param {object} result - Raw Vertex AI response
 * @returns {string} Extracted text
 */
function safeText(result) {
    try {
        return result.response.candidates[0].content.parts[0].text || '';
    } catch {
        return '';
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Process any user input through the full AI pipeline.
 * @param {string} text - Raw user message
 * @returns {Promise<object>} Structured response object
 */
async function processText(text) {
    try {
        const lower = text.toLowerCase().trim();

        // ── Step 1: Handle greetings immediately ──────────────────────────
        if (isGreeting(lower)) {
            return {
                response:
                    'Namaste! 🙏 I am JanVoice AI — your trusted election companion.\n\n' +
                    'I can help you:\n' +
                    '✅ Verify election claims and WhatsApp forwards\n' +
                    '🗳️ Find your polling booth and voting steps\n' +
                    '📚 Learn about the Indian election process\n\n' +
                    'What would you like to know?',
                intent: 'GREETING'
            };
        }

        // ── Step 2: Determine intent ──────────────────────────────────────
        let intent = 'VERIFY'; // default

        if (isGuideQuery(lower)) {
            intent = 'GUIDE';
        } else if (isVentQuery(lower)) {
            intent = 'VENT';
        } else if (aiService) {
            // Use AI service for nuanced intent detection when available
            try {
                const analysis = await aiService.analyzeMessage(text);
                if (analysis?.intent && analysis.intent !== 'UNKNOWN') {
                    intent = analysis.intent;
                }
                // Override AI if strong signals present
                if (isGuideQuery(lower)) intent = 'GUIDE';
            } catch (e) {
                process.stdout.write(JSON.stringify({
                    ts: new Date().toISOString(),
                    level: 'WARN',
                    context: 'IntentDetection',
                    message: 'AI intent detection failed: ' + e.message
                }) + '\n');
            }
        } else if (!mentionsElection(lower)) {
            // No AI available and not election-related
            return {
                response: 'I specialize in Indian election information. Please ask me about voting, EVMs, election procedures, or fact-checking election claims.',
                intent: 'OUT_OF_SCOPE'
            };
        }

        // ── Step 3: Extract claim (best-effort) ───────────────────────────
        let extraction = null;
        if (aiService && intent === 'VERIFY') {
            try {
                extraction = await aiService.extractClaim(text);
            } catch (e) {
                process.stdout.write(JSON.stringify({
                    ts: new Date().toISOString(),
                    level: 'WARN',
                    context: 'ClaimExtraction',
                    message: 'Claim extraction failed: ' + e.message
                }) + '\n');
            }
            if (!extraction?.claim && mentionsElection(lower)) {
                extraction = { claim: normalizeClaim(text), confidence: 0.5, language: 'mixed' };
            }
        }

        // ── Step 4: Route to handler ──────────────────────────────────────
        switch (intent) {
            case 'GUIDE':  return await handleGuide(text);
            case 'LEARN':  return await handleLearn(text);
            case 'VENT':   return await handleVent(text);
            case 'VERIFY':
            default:       return await handleVerify(text, extraction);
        }

    } catch (err) {
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'ERROR',
            context: 'processText',
            message: err.message,
            stack: err.stack
        }) + '\n');
        return {
            response: 'Something went wrong. Please try again.',
            intent: 'ERROR'
        };
    }
}

// ════════════════════════════════════════════════════════════════════════════
// INTENT HANDLERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * VERIFY intent handler — Fact-check an election claim.
 * @param {string} text - User input text
 * @param {object} extraction - Extracted claim details
 * @returns {Promise<object>} Structured response
 */
async function handleVerify(text, extraction) {
    const normalized = normalizeClaim(text);

    // ── Fast path: predefined facts ───────────────────────────────────────
    if (
        normalized.includes('evm') &&
        (normalized.includes('hack') || normalized.includes('safe') ||
         normalized.includes('rig') || normalized.includes('fraud'))
    ) {
        return formatVerifyResponse(PREDEFINED_FACTS.evm);
    }

    if (normalized.includes('voter id') || normalized.includes('id proof')) {
        return formatVerifyResponse(PREDEFINED_FACTS.voter_id);
    }

    // ── AI-powered verification ───────────────────────────────────────────
    if (!extraction?.claim) {
        return {
            response: 'Could you share the exact claim you want me to verify? For example: "EVMs are hacked" or "voting age is 21".',
            intent: 'VERIFY'
        };
    }

    if (!aiService) {
        return {
            response: `I couldn't verify "${extraction.claim}" right now. Please check the official ECI website at eci.gov.in for accurate information.`,
            intent: 'VERIFY'
        };
    }

    try {
        const factCheck = await aiService.verifyClaim(extraction.claim, extraction.language || 'en');
        return formatVerifyResponse(factCheck);
    } catch (e) {
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'ERROR',
            context: 'handleVerify',
            message: e.message
        }) + '\n');
        return {
            response: 'Verification service is temporarily unavailable. Please visit eci.gov.in for official information.',
            intent: 'VERIFY'
        };
    }
}

/**
 * GUIDE intent handler — Explain how to vote / find booth / etc.
 * @param {string} text - User input text
 * @returns {Promise<object>} Structured response
 */
async function handleGuide(text) {
    // Static fallback (always works, even without AI)
    const staticGuide =
        '🗳️ **How to Vote in India — Step by Step**\n\n' +
        '1️⃣  **Check your name** on the voter list at voters.eci.gov.in\n' +
        '2️⃣  **Find your polling booth** using the Voter Helpline App or 1950\n' +
        '3️⃣  **Carry a valid photo ID** (Voter ID, Aadhaar, Passport, etc.)\n' +
        '4️⃣  **Go to your booth** between 7 AM – 6 PM on polling day\n' +
        '5️⃣  **Show your ID** to the polling officer\n' +
        '6️⃣  **Press the button** next to your chosen candidate on the EVM\n' +
        '7️⃣  **Collect your VVPAT slip** (visible for 7 seconds) to confirm\n\n' +
        '📞 Voter Helpline: **1950**\n' +
        '🌐 Official site: **voters.eci.gov.in**';

    if (!aiService) {
        return { response: staticGuide, intent: 'GUIDE' };
    }

    try {
        const prompt =
            `You are a friendly Indian election guide. Explain step-by-step how to vote in India ` +
            `in simple, clear language. Include: how to check voter list, find polling booth, ` +
            `valid IDs accepted, and what happens inside the booth. ` +
            `Always mention voters.eci.gov.in and helpline 1950. Keep it under 200 words. ` +
            `User asked: "${text}"`;

        const result = await aiService.generativeModel.generateContent(prompt);
        const aiText = safeText(result);
        return { response: aiText || staticGuide, intent: 'GUIDE' };
    } catch (e) {
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'WARN',
            context: 'handleGuide',
            message: 'AI error, using static fallback: ' + e.message
        }) + '\n');
        return { response: staticGuide, intent: 'GUIDE' };
    }
}

/**
 * LEARN intent handler — Election education / civic awareness.
 * @param {string} text - User input text
 * @returns {Promise<object>} Structured response
 */
async function handleLearn(text) {
    const staticLearn =
        '📚 **About Indian Elections**\n\n' +
        'India conducts the world\'s largest democratic elections.\n\n' +
        '• The **Election Commission of India (ECI)** is an independent body that oversees all elections.\n' +
        '• **Lok Sabha** elections happen every 5 years; **State Assembly** elections vary by state.\n' +
        '• Citizens aged **18+** who are registered voters can vote.\n' +
        '• The **NOTA** option (None of the Above) is available on EVMs.\n' +
        '• **Model Code of Conduct** kicks in as soon as elections are announced.\n\n' +
        '🌐 Learn more: **eci.gov.in**';

    if (!aiService) {
        return { response: staticLearn, intent: 'LEARN' };
    }

    try {
        const result = await aiService.generativeModel.generateContent(
            `Explain this election topic simply for an Indian voter, under 150 words: "${text}"`
        );
        const aiText = safeText(result);
        return { response: aiText || staticLearn, intent: 'LEARN' };
    } catch (e) {
        return { response: staticLearn, intent: 'LEARN' };
    }
}

/**
 * VENT intent handler — Calm reassurance for frustrated / worried voters.
 * @param {string} text - User input text
 * @returns {Promise<object>} Structured response
 */
async function handleVent(text) {
    const staticVent =
        'I understand your concern — election anxiety is very common. 🙏\n\n' +
        'Your vote is protected by law and the Constitution of India. ' +
        'The Election Commission is an independent body that works hard to ensure free and fair elections.\n\n' +
        'If you witness any malpractice, you can:\n' +
        '📞 Call **1950** (Voter Helpline)\n' +
        '📱 Use the **cVIGIL App** to report violations with photo/video\n\n' +
        'Your voice matters. Democracy is stronger when citizens like you participate.';

    if (!aiService) {
        return { response: staticVent, intent: 'VENT' };
    }

    try {
        const result = await aiService.generativeModel.generateContent(
            `You are a calm, empathetic Indian election counsellor. ` +
            `Respond with reassurance and direct them to official resources. Under 100 words. ` +
            `User says: "${text}"`
        );
        const aiText = safeText(result);
        return { response: aiText || staticVent, intent: 'VENT' };
    } catch (e) {
        return { response: staticVent, intent: 'VENT' };
    }
}

// ════════════════════════════════════════════════════════════════════════════
// RESPONSE FORMATTER
// ════════════════════════════════════════════════════════════════════════════

const VERDICT_EMOJI = { TRUE: '✅', FALSE: '❌', MISLEADING: '⚠️', UNVERIFIABLE: '🔍' };

/**
 * Convert a fact-check data object into a structured API response
 * including a shareable WhatsApp-style card.
 * @param {object} data - Fact-check result
 * @returns {object} Formatted response
 */
function formatVerifyResponse(data) {
    const emoji = VERDICT_EMOJI[data.verdict] || '🔍';

    const card = [
        '─────────────────────────',
        `${emoji} VERDICT: ${data.verdict}`,
        `📋 Claim: ${data.claim}`,
        `📌 Fact: ${data.fact}`,
        `🏛️ Source: ${data.source}`,
        data.source_url ? `🔗 ${data.source_url}` : null,
        '─────────────────────────',
        '🤖 Verified by JanVoice AI | eci.gov.in'
    ].filter(Boolean).join('\n');

    return {
        verdict: data.verdict,
        confidence: data.confidence || null,
        response: `${data.explanation}\n\n💡 What to do: ${data.action}`,
        card,
        source: data.source,
        source_url: data.source_url || null,
        intent: 'VERIFY'
    };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
    processText,
    getGuide: handleGuide,
    getEducation: handleLearn
};

