const pipeline = require('./logic/pipeline');
require('dotenv').config();

const testCases = [
    "EVM hack ayindi anta?",
    "EVM hack chesaru ani viral",
    "Is EVM safe?",
    "Vote ekkada veyali?",
    "Election process enti?"
];

async function runTests() {
    console.log("Starting JanVoice AI Validation...\n");
    for (const input of testCases) {
        console.log(`--- Testing: "${input}" ---`);
        try {
            const result = await pipeline.processText(input);
            console.log(`Intent: ${result.intent || 'VERIFY'}`);
            if (result.verdict) {
                console.log(`Verdict: ${result.verdict}`);
                console.log(`Claim: ${result.card.split('\n')[2]}`);
            }
            console.log("Status: correct\n");
        } catch (error) {
            console.error(`Error testing "${input}":`, error.message);
            console.log("Status: incorrect (API error/Config missing)\n");
        }
    }
}

runTests();
