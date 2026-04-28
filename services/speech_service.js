'use strict';

const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

/**
 * JanVoice AI — Speech Service
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) using Google Cloud APIs.
 */

const sttClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * Transcribe an audio buffer using Google Cloud Speech-to-Text.
 * Supports English, Hindi, and Telugu.
 * @param {Buffer} audioBuffer - Buffer containing audio data
 * @returns {Promise<object>} Transcribed text or error object
 */
async function transcribe(audioBuffer) {
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
        return { error: 'INVALID_INPUT_BUFFER' };
    }

    try {
        const audioBytes = audioBuffer.toString('base64');

        const audio = { content: audioBytes };
        const config = {
            encoding: 'WEBM_OPUS', // Default for browser recording
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
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'ERROR',
            context: 'transcribe',
            message: error.message
        }) + '\n');
        throw error;
    }
}

/**
 * Synthesize text into an audio buffer using Google Cloud Text-to-Speech.
 * @param {string} text - Text to synthesize
 * @param {string} languageCode - Target language code (default: en-IN)
 * @returns {Promise<Buffer>} Audio content buffer
 */
async function synthesize(text, languageCode = 'en-IN') {
    if (!text || typeof text !== 'string') {
        throw new Error('Valid text is required for synthesis');
    }

    try {
        const request = {
            input: { text },
            voice: { languageCode, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        return response.audioContent;
    } catch (error) {
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'ERROR',
            context: 'synthesize',
            message: error.message
        }) + '\n');
        throw error;
    }
}

module.exports = {
    transcribe,
    synthesize
};

