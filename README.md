# Election_Process_Education_1
# 🗳️ JanVoice AI

### Multilingual Election Intelligence Assistant for Indian Voters

---

## 🚀 Overview

**JanVoice AI** is a production-ready, AI-powered election assistant designed to help Indian citizens:

* Verify election-related information
* Understand voting procedures
* Navigate polling logistics
* Resist misinformation spread via WhatsApp and voice messages

It is built specifically for **real-world Indian usage**, focusing on multilingual input, accessibility, and misinformation control.

---

## 🎯 Problem Statement

Election misinformation spreads rapidly in India through:

* WhatsApp forwards (text, images, voice)
* Regional languages and dialects
* First-time voters lacking guidance

Existing solutions:

* Assume English proficiency
* Do not support voice/image verification
* Fail to address emotional trust barriers

---

## 💡 Solution

JanVoice AI acts as a **trusted civic companion** that:

* Verifies election claims using official sources (ECI)
* Explains processes in simple, local language
* Guides users step-by-step for voting
* Generates shareable fact-check responses

---

## 🔥 Key Features

### 1. Multi-Modal Input

* 📝 Text (WhatsApp messages)
* 🖼️ Image (OCR using Vision API)
* 🎤 Audio (Speech-to-Text)

---

### 2. AI-Powered Fact Verification

* Uses **Google Vertex AI (Gemini 1.5 Pro)**
* Classifies claims as:

  * TRUE
  * FALSE
  * MISLEADING
  * UNVERIFIABLE

---

### 3. Multilingual Support

* Telugu (priority)
* Hindi
* English
* Tanglish (code-mixed)

---

### 4. Intelligent Intent Routing

* VERIFY → Fact-check claims
* GUIDE → Voting instructions
* LEARN → Election education
* VENT → Emotional reassurance

---

### 5. WhatsApp Shareable Cards (Unique Feature)

Generates short, shareable responses to:
➡️ Counter misinformation
➡️ Enable re-forwarding of truth

---

## ⚙️ Tech Stack

| Layer   | Technology                        |
| ------- | --------------------------------- |
| Backend | Node.js, Express                  |
| AI      | Google Vertex AI (Gemini 1.5 Pro) |
| OCR     | Google Vision API                 |
| Speech  | Google Speech-to-Text             |
| Hosting | Google Cloud Run                  |
| Storage | In-memory caching                 |

---

## 🏗️ Architecture

```
User Input
   ↓
Pipeline (Intent + Claim Extraction)
   ↓
AI Verification (Vertex AI)
   ↓
Response + Shareable Card
```

---

## 🚀 How to Run Locally

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

Create `.env`:

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

---

## ☁️ Deployment (Cloud Run)

```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/janvoice-ai

gcloud run deploy janvoice-ai \
  --image gcr.io/<PROJECT_ID>/janvoice-ai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🧪 Example API

### Verify Text

```bash
POST /verify/text
{
  "text": "EVM hack ayindi anta?"
}
```

---

## 🏆 What Makes This Stand Out

### 🔥 1. Real-World Focus

Built for **actual Indian users**, not ideal scenarios.

---

### 🔥 2. WhatsApp-Native Thinking

Fights misinformation using:
➡️ Shareable verification responses
➡️ Viral counter-mechanism

---

### 🔥 3. Multilingual + Voice First

Supports:

* Rural users
* First-time voters
* Non-English speakers

---

### 🔥 4. Robust Engineering

* Fault-tolerant pipeline
* Safe JSON parsing
* Rate limiting + caching
* Multi-modal processing

---

### 🔥 5. Ethical AI Design

* Strictly non-partisan
* Uses verified public sources
* Avoids hallucination

---

## 🔮 Future Enhancements

* Booth-level personalization
* Candidate promise tracking
* Offline SMS support
* WhatsApp integration

---

## 🤝 Acknowledgements

Built as part of a challenge supported by:

* Google Developers
* Hack2Skill

---

## 📌 Final Thought

> Democracy works best when citizens are informed.

JanVoice AI aims to make that possible—**for everyone, in every language.**
