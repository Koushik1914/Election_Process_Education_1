const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

const sttClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

async function transcribe(audioBuffer) {
    try {
        const audioBytes = audioBuffer.toString('base64');

        const audio = { content: audioBytes };
        const config = {
            encoding: 'WEBM_OPUS', // Default for browser recording, adjust as needed
            sampleRateHertz: 48000,
            languageCode: 'en-IN',
            alternativeLanguageCodes: ['hi-IN', 'te-IN'],
        };

        const request = { audio, config };

        const [response] = await sttClient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        if (!transcription || transcription.trim().split(' ').length < 5) {
            return { error: 'AUDIO_UNCLEAR' };
        }

        return { text: transcription };
    } catch (error) {
        console.error('Speech-to-Text Error:', error);
        throw error;
    }
}

async function synthesize(text, languageCode = 'en-IN') {
    try {
        const request = {
            input: { text },
            voice: { languageCode, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        return response.audioContent;
    } catch (error) {
        console.error('Text-to-Speech Error:', error);
        throw error;
    }
}

module.exports = {
    transcribe,
    synthesize
};
