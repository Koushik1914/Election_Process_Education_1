'use strict';

const vision = require('@google-cloud/vision');

/**
 * JanVoice AI — Vision Service
 * Uses Google Cloud Vision API to extract text from images (OCR).
 */

const client = new vision.ImageAnnotatorClient();

/**
 * Extract text from an image buffer using Google Cloud Vision OCR.
 * @param {Buffer} imageBuffer - Buffer containing image data
 * @returns {Promise<object>} Extracted text or error object
 */
async function extractText(imageBuffer) {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
        return { error: 'INVALID_INPUT_BUFFER' };
    }

    try {
        const [result] = await client.documentTextDetection({ image: { content: imageBuffer } });
        const fullTextAnnotation = result.fullTextAnnotation;
        
        if (!fullTextAnnotation || !fullTextAnnotation.text) {
            return { error: 'OCR_LOW_QUALITY' };
        }

        const text = fullTextAnnotation.text.trim();
        
        // OCR Quality Check: < 10 characters or appears garbled
        if (text.length < 10) {
            return { error: 'OCR_LOW_QUALITY' };
        }

        return { text };
    } catch (error) {
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'ERROR',
            context: 'extractText',
            message: error.message
        }) + '\n');
        throw error;
    }
}

module.exports = {
    extractText
};

