# AutoGrade

Smart grading, happy teaching

**This document describes the proof-of-concept (POC) plan only** — not a final product or full production architecture.

Web app for uploading an empty exam, a solved exam, and a rubric at once, grading them through a two-stage AI pipeline, and showing the score in the UI.

## Flow

- Upload an empty exam, a solved exam, and a rubric.
- The `/api/grade` endpoint accepts both PDFs and the rubric text.
- **OCR stage**: both PDFs are stitched into images and sent to Mistral Pixtral in a single vision call, which returns the questions and the student's answers as structured JSON.
- **Grading stage**: the extracted Q&A and the rubric are sent to OpenAI (GPT-4.1-mini), which returns per-question deductions and a rationale.
- The final score is computed deterministically as `max_score - sum(deductions)` (the grader's own score is overridden).
- The API returns the score, deductions, rationale, and extracted Q&A to the frontend.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + TypeScript + Vite

## Environment variables

Create `backend/.env` (gitignored) with:

```
MISTRAL_API_KEY=...   # used by OCR (Pixtral)
OPENAI_API_KEY=...    # used by grading (GPT-4.1-mini)
```

Both keys are required — OCR runs on Mistral, grading runs on OpenAI.

## Running the backend

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8002
```

Runs at http://localhost:8002

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173
