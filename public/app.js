const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const imageUpload = document.getElementById('image-upload');
const recordBtn = document.getElementById('record-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

// Send Message
sendBtn.addEventListener('click', () => {
    const text = userInput.value.trim();
    if (text) {
        addMessage(text, 'user-message');
        userInput.value = '';
        userInput.style.height = 'auto';
        processText(text);
    }
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Image Upload
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('File too large. Max 5MB.');
            return;
        }
        addMessage(`[Image Uploaded: ${file.name}]`, 'user-message');
        processImage(file);
    }
});

// Audio Recording
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
                addMessage(`[Voice Message Recorded]`, 'user-message');
                processAudio(file);
            };

            mediaRecorder.start();
            isRecording = true;
            recordBtn.classList.add('recording');
            recordBtn.style.color = '#ef4444';
            showStatus('Recording...');
        } catch (err) {
            console.error('Recording error:', err);
            alert('Could not access microphone.');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.style.color = '';
        hideStatus();
    }
});

async function processText(text) {
    showStatus('Verifying claim...');
    try {
        const response = await fetch('/verify/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await response.json();
        handleApiResponse(data);
    } catch (error) {
        addMessage('Server error. Please try again later.', 'bot-message');
    } finally {
        hideStatus();
    }
}

async function processImage(file) {
    showStatus('Extracting text from image...');
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/verify/image', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        handleApiResponse(data);
    } catch (error) {
        addMessage('Error processing image. Please type your message.', 'bot-message');
    } finally {
        hideStatus();
    }
}

async function processAudio(file) {
    showStatus('Transcribing audio...');
    const formData = new FormData();
    formData.append('audio', file);

    try {
        const response = await fetch('/verify/audio', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        handleApiResponse(data);
    } catch (error) {
        addMessage('Error processing audio. Please try again or type.', 'bot-message');
    } finally {
        hideStatus();
    }
}

function handleApiResponse(data) {
    if (data.error) {
        if (data.error === 'OCR_LOW_QUALITY') {
            addMessage('The text in the image is unclear or too short. Please type your message manually.', 'bot-message');
        } else {
            addMessage(data.error, 'bot-message');
        }
        return;
    }

    if (data.verdict) {
        addVerifyResponse(data);
    } else {
        addMessage(data.response, 'bot-message');
    }
}

function addMessage(text, className) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.innerText = text;
    messagesContainer.appendChild(div);
    scrollToBottom();
}

function addVerifyResponse(data) {
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'message bot-message';
    
    let html = `<p>${data.response.replace(/\n/g, '<br>')}</p>`;
    
    html += `
        <div class="verdict-card ${data.verdict}">
            <div class="card-title">${getVerdictEmoji(data.verdict)} ${data.verdict}</div>
            <p><strong>Claim:</strong> ${data.claim}</p>
            <p><strong>Fact:</strong> ${data.fact}</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${data.confidence}%"></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted)">Source: ${data.source}</p>
            ${data.source_url ? `<a href="${data.source_url}" target="_blank" style="font-size: 0.8rem; color: var(--primary)">Read Official Data</a>` : ''}
        </div>
    `;

    if (data.card) {
        html += `
            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem; font-family: monospace; font-size: 0.8rem; border: 1px dashed var(--border-color)">
                <p style="color: var(--text-muted); margin-bottom: 0.5rem;">WhatsApp Shareable Card:</p>
                ${data.card.replace(/\n/g, '<br>')}
            </div>
        `;
    }

    botMsgDiv.innerHTML = html;
    messagesContainer.appendChild(botMsgDiv);
    scrollToBottom();
}

function getVerdictEmoji(verdict) {
    return { 'TRUE': '✅', 'FALSE': '❌', 'MISLEADING': '⚠️', 'UNVERIFIABLE': '🔍' }[verdict] || '🔍';
}

function showStatus(text) {
    statusText.innerText = text;
    statusIndicator.classList.remove('hidden');
    scrollToBottom();
}

function hideStatus() {
    statusIndicator.classList.add('hidden');
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
