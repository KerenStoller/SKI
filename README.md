# AutoGrade 📝

> **Note:** This document describes the proof-of-concept (POC) plan only — not a final product or full production architecture.

AutoGrade is a web app for uploading an empty exam, a solved exam, and a rubric at once, grading them through a two-stage AI pipeline, and managing them in a dynamic cloud workspace.

## 🌊 Flow

- **Upload:** Submit an empty exam, a solved exam, and a rubric, assigning them to a specific class folder and student ID.
- **OCR Stage (Mistral Document AI):** Each PDF is processed with mistral-ocr-latest → markdown transcript. Low-confidence pages are rejected (with one retry).
- **Grading Stage (OpenAI):** The questions transcript, answers transcript, and rubric are sent to GPT-4o-mini in one call. OpenAI aligns questions with student work and applies the rubric.
- **Cloud Archiving:** The uploaded PDFs are routed directly to Supabase Storage using dynamically generated virtual class folders.

## 🛠️ Stack

- **Backend:** Python + FastAPI
- **Frontend:** React + TypeScript + Vite
- **Database:** PostgreSQL (SQLAlchemy + JSONB payloads)
- **Storage:** Supabase Storage (Cloud PDF hosting)

## How to run?
- **Running the backend** 

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```
Runs at http://localhost:8000

- **Running the frontend**
 
 ```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173