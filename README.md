# 🗳️ JanVoice AI
### Multilingual Election Intelligence Assistant for Indian Voters

> **Democracy works best when citizens are informed.**
> JanVoice AI makes that possible — for everyone, in every language.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Security](#security)
- [Accessibility](#accessibility)
- [Google Services Integration](#google-services-integration)
- [Testing](#testing)
- [How to Run Locally](#how-to-run-locally)
- [Deployment (Cloud Run)](#deployment-cloud-run)
- [API Reference](#api-reference)
- [What Makes This Stand Out](#what-makes-this-stand-out)
- [Future Enhancements](#future-enhancements)
- [Acknowledgements](#acknowledgements)

---

## 🚀 Overview

**JanVoice AI** is a production-ready, AI-powered election assistant built specifically for Indian citizens. It helps voters:

- ✅ Verify election-related claims and WhatsApp forwards
- 🗳️ Understand voting procedures step-by-step
- 📍 Navigate polling booth logistics
- 📚 Learn about the Indian election process
- 🛡️ Resist misinformation spread via WhatsApp and voice messages

Built for **real-world Indian usage** with a strong focus on multilingual input, voice accessibility, and misinformation control.

---

## 🎯 Problem Statement

Election misinformation spreads rapidly in India through:

- WhatsApp forwards (text, images, voice)
- Regional languages and dialects (Telugu, Hindi, Tanglish)
- First-time voters lacking civic guidance

**Existing solutions fail because they:**
- Assume English proficiency
- Do not support voice/image verification
- Do not address emotional trust barriers

---

## 💡 Solution

JanVoice AI acts as a **trusted civic companion** that:

- Verifies election claims against official ECI sources
- Explains processes in simple, local language
- Guides users step-by-step through the voting process
- Generates shareable fact-check responses to counter misinformation

---

## 🔥 Key Features

### 1. Multi-Modal Input
| Mode | Technology | Use Case |
|------|-----------|---------|
| 📝 Text | Direct input | WhatsApp message text |
| 🖼️ Image | Google Vision API (OCR) | Screenshot verification |
| 🎤 Audio | Google Speech-to-Text | Voice message processing |

### 2. AI-Powered Fact Verification
Using **Google Vertex AI (Gemini 1.5 Pro)** to classify claims as:
- ✅ **TRUE** — Verified accurate information
- ❌ **FALSE** — Debunked misinformation
- ⚠️ **MISLEADING** — Partially accurate but deceptive
- 🔍 **UNVERIFIABLE** — Cannot be confirmed or denied

### 3. Multilingual Support
- 🇮🇳 **Telugu** (priority language)
- 🇮🇳 **Hindi**
- 🌐 **English**
- 🔀 **Tanglish** (code-mixed Telugu-English)

### 4. Intelligent Intent Routing
| Intent | Action |
|--------|--------|
| `VERIFY` | Fact-check the claim against official sources |
| `GUIDE` | Step-by-step voting instructions |
| `LEARN` | Election education and civic awareness |
| `VENT` | Calm emotional reassurance + helpline info |
| `GREETING` | Friendly onboarding response |

### 5. WhatsApp Shareable Cards (Unique Feature)
Generates compact, shareable verification cards to:
- Counter misinformation at the source
- Enable viral spread of verified facts
- Attribute claims to official sources (ECI)

---

## 🏗️ Architecture

```
User Input (Text / Image / Audio)
           │
           ▼
   ┌───────────────────┐
   │  Input Processing  │  OCR / Speech-to-Text
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │   Intent Router   │  VERIFY / GUIDE / LEARN / VENT
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │  Claim Extraction │  Normalize + Language Detect
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │  AI Verification  │  Vertex AI (Gemini 1.5 Pro)
   │  + Predefined DB  │  Fast-path for common claims
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │ Response + Card   │  Structured JSON + Shareable Card
   └───────────────────┘
            │
            ▼
       User / WhatsApp
```

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js 18+, Express 4 | API server |
| **AI Reasoning** | Google Vertex AI (Gemini 1.5 Pro) | Fact-checking + NLU |
| **OCR** | Google Vision API | Image text extraction |
| **Speech** | Google Speech-to-Text | Voice transcription |
| **Hosting** | Google Cloud Run | Serverless deployment |
| **Storage** | In-memory cache (NodeCache) | Response caching |
| **Rate Limiting** | express-rate-limit | Abuse prevention |
| **File Handling** | Multer (memory storage) | File uploads |
| **Testing** | Jest + Supertest | API test suite |

---

## 🔐 Security

JanVoice AI is built with security at every layer:

### HTTP Security Headers
Every response includes:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'
```

### Input Validation
- All text inputs validated for type, length (max 2000 chars), and content
- File uploads restricted to allowed MIME types (JPEG, PNG, MP3, WAV, OGG, WEBM)
- File size limit enforced at 5 MB
- SQL/code injection not applicable (no database queries)

### Rate Limiting
- 20 requests per minute per IP address
- Prevents API abuse and protects backend costs

### Authentication & API Keys
- **No API keys exposed to the client** — all credentials handled server-side via Google Application Default Credentials (ADC)
- `.env` file excluded from repository via `.gitignore`
- Cloud Run uses service account with least-privilege IAM roles

### Caching
- Verified claim results cached for 5 minutes (reduces AI calls)
- Cache keyed on normalized, lowercased input
- Maximum 100 entries to prevent memory exhaustion

---

## ♿ Accessibility

JanVoice AI is designed to be usable by **all Indian voters**, including those with disabilities:

### WCAG 2.1 AA Compliance
- All interactive elements have descriptive `aria-label` attributes
- Form inputs have associated `<label>` elements
- Skip navigation link for keyboard users
- Focus management maintained throughout the chat flow

### Voice Input
- Audio recording supported via browser MediaRecorder API
- Google Speech-to-Text handles transcription
- Supports rural users with low literacy

### Screen Reader Support
- Chat messages announced via `aria-live="polite"` region
- Processing state announced via `role="status"`
- Error messages announced via `aria-live="assertive"`
- Images and icons have `aria-hidden="true"` or descriptive labels

### Multilingual Support
- Interface supports Telugu, Hindi, and English input
- Transliterated input (Tanglish) also handled
- Simple vocabulary suitable for first-time voters

### Visual Accessibility
- Sufficient color contrast ratios (4.5:1 minimum)
- Font sizes scalable (rem units)
- Buttons and touch targets meet 44×44px minimum size
- Character counter for input length awareness

---

## 🌐 Google Services Integration

JanVoice AI leverages four Google Cloud services in an integrated pipeline:

### 1. Vertex AI (Gemini 1.5 Pro)
**Used for:** Claim extraction, intent detection, fact verification, multilingual response generation

```javascript
// Example: Fact verification via Vertex AI
const result = await aiService.verifyClaim(claim, language);
// Returns: { verdict, confidence, explanation, action, source }
```

- Handles Telugu, Hindi, English, and Tanglish input natively
- Grounded in ECI knowledge to minimize hallucination
- Fallback to predefined fact database for critical claims (EVM, NOTA, voting ID)

### 2. Google Vision API
**Used for:** OCR extraction from WhatsApp screenshots and forwarded images

```javascript
// Example: Extract text from an uploaded image
const ocrResult = await visionService.extractText(imageBuffer);
// Returns: { text: "extracted text from image" }
```

- Handles compressed WhatsApp image quality
- Extracts text from screenshots of election claims

### 3. Google Speech-to-Text
**Used for:** Transcribing voice notes and audio WhatsApp messages

```javascript
// Example: Transcribe audio buffer
const transcript = await speechService.transcribe(audioBuffer);
// Returns: { text: "transcribed speech" }
```

- Supports Indian English, Hindi, and Telugu audio
- Enables access for users with low literacy

### 4. Google Cloud Run
**Used for:** Serverless hosting with auto-scaling

- Scales to zero when idle (cost-efficient)
- Handles traffic spikes during election periods
- No server management required
- Global CDN for low latency

---

## 🧪 Testing

JanVoice AI includes a comprehensive test suite covering API endpoints, security headers, and core pipeline logic.

### Run Tests

```bash
npm test
```

### Test Coverage

| Area | Tests |
|------|-------|
| Health check endpoint | ✅ |
| `/verify/text` — valid inputs | ✅ |
| `/verify/text` — invalid/missing inputs | ✅ |
| `/verify/text` — EVM claim verdict | ✅ |
| `/guide` — valid queries | ✅ |
| `/guide` — missing input | ✅ |
| `/learn` — valid topics | ✅ |
| Security headers (X-Frame, XSS, MIME) | ✅ |
| 404 handler | ✅ |
| Pipeline unit tests (greeting, verify, guide) | ✅ |

### Test Stack
- **Jest** — test runner and assertions
- **Supertest** — HTTP endpoint testing
- **Jest mocks** — AI/GCP services mocked for offline testing

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js 18+
- Google Cloud SDK installed
- Active GCP project with Vertex AI, Vision, Speech APIs enabled

### 1. Clone Repository
```bash
git clone <repo-url>
cd janvoice-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment
Create `.env` in project root:
```env
GOOGLE_CLOUD_PROJECT=your-project-id
PORT=3000
```

### 4. Authenticate GCP
```bash
gcloud auth application-default login
```

### 5. Run Server
```bash
node server.js
```

### 6. Run Tests
```bash
npm test
```

Server will be available at `http://localhost:3000`

---

## ☁️ Deployment (Cloud Run)

```bash
# Build and push container
gcloud builds submit --tag gcr.io/<PROJECT_ID>/janvoice-ai

# Deploy to Cloud Run
gcloud run deploy janvoice-ai \
  --image gcr.io/<PROJECT_ID>/janvoice-ai \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=<PROJECT_ID>
```

---

## 📡 API Reference

### `POST /verify/text`
Verify a text claim against election facts.

**Request:**
```json
{ "text": "EVM hack ayindi anta?" }
```

**Response:**
```json
{
  "verdict": "FALSE",
  "confidence": 99,
  "response": "EVMs have no network connectivity...",
  "card": "❌ VERDICT: FALSE\n📋 Claim: EVMs are hacked...",
  "source": "Election Commission of India (ECI)",
  "source_url": "https://www.eci.gov.in/evm/",
  "intent": "VERIFY"
}
```

### `POST /verify/image`
Upload an image for OCR-based fact checking.

**Request:** `multipart/form-data` with field `image` (JPEG/PNG, max 5 MB)

### `POST /verify/audio`
Upload audio for transcription + fact checking.

**Request:** `multipart/form-data` with field `audio` (MP3/WAV/OGG/WEBM, max 5 MB)

### `POST /guide`
Get step-by-step voting guidance.

**Request:**
```json
{ "query": "how to vote" }
```

### `POST /learn`
Learn about an election topic.

**Request:**
```json
{ "topic": "What is NOTA?" }
```

### `GET /health`
Health check endpoint.

**Response:**
```json
{ "status": "ok", "version": "1.0.0", "timestamp": "..." }
```

---

## 🏆 What Makes This Stand Out

### 🔥 Real-World Focus
Built for **actual Indian users**, not ideal scenarios. Handles Tanglish, incomplete sentences, and low-quality audio.

### 🔥 WhatsApp-Native Design
Fights misinformation at its source with shareable verification cards designed for re-forwarding.

### 🔥 Multilingual + Voice First
Supports rural users, first-time voters, and non-English speakers with voice input and regional language processing.

### 🔥 Robust Engineering
- Fault-tolerant pipeline with static fallbacks for all AI failures
- Safe JSON parsing with try/catch at every layer
- Rate limiting + response caching
- Multi-modal input processing

### 🔥 Ethical AI Design
- Strictly non-partisan — no political opinions
- Uses only verified public sources (ECI)
- Confidence scores disclosed to users
- Predefined fact database prevents AI hallucination on critical claims

---

## 🔮 Future Enhancements

- [ ] Booth-level personalization using voter roll number
- [ ] Candidate promise tracking + manifesto comparison
- [ ] Official WhatsApp Business API integration
- [ ] Offline SMS support via Twilio
- [ ] Push notifications for election day reminders
- [ ] District-level turnout statistics

---

## 🤝 Acknowledgements

Built as part of a challenge supported by:
- **Google Developers**
- **Hack2Skill**

---

## 📜 License

MIT License — free to use, fork, and build upon.

---

*JanVoice AI — Empowering every Indian voter with verified information.* 🇮🇳