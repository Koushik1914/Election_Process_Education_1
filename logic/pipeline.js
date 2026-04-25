const aiService = require('../services/ai_service');

// ===============================
// 🔧 Utility Functions
// ===============================

function normalizeClaim(text) {
    return text
        .toLowerCase()
        .replace(/\?/g, "")
        .replace(/anta|ah|na/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isGreeting(text) {
    return /^(hi|hello|hey|namaste|vanakkam)/i.test(text.trim());
}

const ELECTION_KEYWORDS = [
    "evm", "vote", "voting", "election", "booth",
    "poll", "eci", "candidate", "ballot",
    "hack", "fraud", "rigged", "result"
];

function mentionsElection(text) {
    const t = text.toLowerCase();
    return ELECTION_KEYWORDS.some(k => t.includes(k));
}

// ✅ STRONG GUIDE DETECTION (FIXED)
function isGuideQuery(text) {
    const t = text.toLowerCase();

    return (
        t.includes("where") ||
        t.includes("ekkada") ||
        t.includes("kaha") ||
        t.includes("how to vote") ||
        t.includes("how to") ||
        t.includes("process") ||
        t.includes("register") ||
        t.includes("vote")
    );
}

// ===============================
// 🔥 Demo Reliability Layer
// ===============================

const PREDEFINED_FACTS = {
    evm: {
        verdict: "FALSE",
        confidence: 99,
        claim: "EVMs are hacked.",
        fact: "EVMs are standalone machines with no wireless communication capabilities.",
        source: "Election Commission of India (ECI)",
        source_url: "https://www.eci.gov.in/evm/",
        explanation: "Indian EVMs are not connected to any network and cannot be hacked remotely.",
        spread_reason: "Fear and misunderstanding of EVM technology.",
        action: "Check official ECI resources for clarity."
    }
};

// ===============================
// 🔧 SAFE TEXT EXTRACTION
// ===============================

function safeText(result) {
    try {
        return result.response.candidates[0].content.parts[0].text;
    } catch {
        return "Sorry, I couldn't process that right now. Please try again.";
    }
}

// ===============================
// 🚀 MAIN PIPELINE
// ===============================

async function processText(text) {
    try {
        const lowerText = text.toLowerCase().trim();

        // Greeting
        if (isGreeting(lowerText)) {
            return {
                response: "Hi! I can verify election claims, help you find your polling booth, or explain the voting process. What would you like to do?",
                intent: "GREETING"
            };
        }

        // Extract claim
        let extraction = await aiService.extractClaim(text);

        if (!extraction || !extraction.claim) {
            if (mentionsElection(text)) {
                extraction = {
                    claim: normalizeClaim(text),
                    confidence: 0.5,
                    language: "mixed"
                };
            }
        }

        const analysis = await aiService.analyzeMessage(text);

        if (extraction?.language) {
            analysis.language = extraction.language;
        }

        // ✅ FIXED INTENT LOGIC
        if (isGuideQuery(text)) {
            analysis.intent = "GUIDE";
        } else if (analysis.intent === "UNKNOWN") {
            if (mentionsElection(text)) {
                analysis.intent = "VERIFY";
            }
        }

        // Routing
        switch (analysis.intent) {
            case "VERIFY":
                return await handleVerify(text, analysis, extraction);
            case "GUIDE":
                return await handleGuide(text, analysis);
            case "LEARN":
                return await handleLearn(text, analysis);
            case "VENT":
                return await handleVent(text, analysis);
            default:
                return await handleVerify(text, analysis, extraction);
        }

    } catch (e) {
        console.error("Pipeline error:", e);
        return {
            response: "Something went wrong. Please try again.",
            intent: "ERROR"
        };
    }
}

// ===============================
// 🔍 VERIFY HANDLER
// ===============================

async function handleVerify(text, analysis, extraction) {

    const normalized = normalizeClaim(text);

    if (
        normalized.includes("evm") &&
        (normalized.includes("hack") ||
            normalized.includes("safe") ||
            normalized.includes("rigged") ||
            normalized.includes("fraud"))
    ) {
        return formatVerifyResponse(PREDEFINED_FACTS.evm, analysis);
    }

    if (!extraction?.claim) {
        return {
            response: "Could you share the exact claim you want me to verify?",
            intent: "VERIFY"
        };
    }

    const factCheck = await aiService.verifyClaim(
        extraction.claim,
        analysis.language
    );

    return formatVerifyResponse(factCheck, analysis);
}

// ===============================
// 🎯 RESPONSE FORMATTER
// ===============================

function formatVerifyResponse(data, analysis) {

    const verdictEmoji = {
        TRUE: "✅",
        FALSE: "❌",
        MISLEADING: "⚠️",
        UNVERIFIABLE: "🔍"
    }[data.verdict] || "🔍";

    return {
        verdict: data.verdict,
        response: `${data.explanation}\n\nWhat to do: ${data.action}`,
        card: `
---CARD START---
${verdictEmoji} ${data.verdict}
Claim: ${data.claim}
Fact: ${data.fact}
Source: ${data.source}
---CARD END---
        `.trim()
    };
}

// ===============================
// 📚 SAFE HANDLERS (FIXED)
// ===============================

async function handleGuide(text, analysis) {
    try {
        const prompt = `Explain step-by-step how to vote in India in simple language. Include voters.eci.gov.in.`;
        const result = await aiService.generativeModel.generateContent(prompt);

        return {
            response: safeText(result),
            intent: "GUIDE"
        };
    } catch (e) {
        console.error("Guide error:", e);

        return {
            response:
                "Here’s how to vote:\n1. Find your polling booth at voters.eci.gov.in\n2. Carry valid ID\n3. Press button on EVM\n4. Confirm your vote",
            intent: "GUIDE"
        };
    }
}

async function handleLearn(text, analysis) {
    try {
        const result = await aiService.generativeModel.generateContent(
            `Explain simply: ${text}`
        );
        return { response: safeText(result), intent: "LEARN" };
    } catch {
        return { response: "Learning info not available right now.", intent: "LEARN" };
    }
}

async function handleVent(text, analysis) {
    try {
        const result = await aiService.generativeModel.generateContent(
            `Respond calmly: ${text}`
        );
        return { response: safeText(result), intent: "VENT" };
    } catch {
        return { response: "I understand your concern. Please check official sources.", intent: "VENT" };
    }
}

module.exports = {
    processText,
    getGuide: handleGuide,
    getEducation: handleLearn
};