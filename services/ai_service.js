const { VertexAI } = require('@google-cloud/vertexai');

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = 'us-central1';
const modelName = 'gemini-1.5-flash';

const vertexAI = new VertexAI({ project, location });

const generativeModel = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
    },
});

// ===============================
// 🔧 SAFE JSON PARSER
// ===============================
function safeJSONParse(text) {
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

// ===============================
// 🔧 SAFE TEXT EXTRACTION
// ===============================
function getText(result) {
    try {
        return result.response.candidates[0].content.parts[0].text;
    } catch {
        return "";
    }
}

// ===============================
// 🔧 NORMALIZE CLAIM
// ===============================
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/\?/g, "")
        .replace(/anta|ah|na/gi, "")
        .trim();
}

// ===============================
// 🔍 ANALYZE MESSAGE
// ===============================
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

        return data || { tone: "practical", intent: "VERIFY", language: "English" };
    } catch (e) {
        console.error("analyzeMessage error:", e);
        return { tone: "practical", intent: "VERIFY", language: "English" };
    }
}

// ===============================
// 🔍 CLAIM EXTRACTION
// ===============================
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

        // 🔥 FALLBACK (CRITICAL)
        if (!data || !data.claim) {
            return {
                claim: normalize(message),
                language: "mixed",
                confidence: 0.5
            };
        }

        return data;

    } catch (e) {
        console.error("extractClaim error:", e);
        return {
            claim: normalize(message),
            language: "mixed",
            confidence: 0.5
        };
    }
}

// ===============================
// 🔍 VERIFY CLAIM
// ===============================
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
            throw new Error("Invalid JSON from model");
        }

        // 🔥 CONFIDENCE SAFETY
        if (data.confidence < 60) {
            return {
                verdict: "UNVERIFIABLE",
                confidence: data.confidence || 0,
                claim: cleanClaim,
                fact: "Could not verify using official sources.",
                source: "ECI",
                source_url: "https://eci.gov.in",
                explanation: "Information is insufficient or unclear.",
                spread_reason: "Unverified claims spread easily.",
                action: "Check official sources."
            };
        }

        return data;

    } catch (e) {
        console.error("verifyClaim error:", e);

        return {
            verdict: "UNVERIFIABLE",
            confidence: 0,
            claim: cleanClaim,
            fact: "System could not verify the claim.",
            source: "ECI",
            source_url: "https://eci.gov.in",
            explanation: "Temporary issue while verifying.",
            spread_reason: "Technical limitation.",
            action: "Try again later."
        };
    }
}

// ===============================
module.exports = {
    analyzeMessage,
    extractClaim,
    verifyClaim,
    generativeModel,
    safeJSONParse
};