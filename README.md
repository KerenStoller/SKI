# AutoGrade

Smart grading, happy teaching

**This document describes the proof-of-concept (POC) plan only** — not a final product or full production architecture.

Web app for uploading an empty exam, a solved exam, and a rubric at once, grading via Mistral, and showing the score in the UI.

## Flow

- Upload an empty exam and a solved exam at the same time, plus a rubric.
- An API endpoint accepts two documents.
- Both documents are sent to Mistral in parallel.
- Mistral returns responses to the API.
- The API derives the score from the Mistral output **and** the rubric.
- The API returns the score to the frontend.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + TypeScript + Vite

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
