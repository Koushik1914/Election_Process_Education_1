const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

async function extractText(imageBuffer) {
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
        console.error('Vision API Error:', error);
        throw error;
    }
}

module.exports = {
    extractText
};
