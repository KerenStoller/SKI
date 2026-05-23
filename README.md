# AutoGrade

Smart grading, happy teaching

**This document describes the proof-of-concept (POC) plan only** — not a final product or full production architecture.

Web app for uploading an empty exam, a solved exam, and a rubric at once, grading them through a two-stage AI pipeline, and showing the score in the UI.

## Flow

- Upload an empty exam, a solved exam, and a rubric.
- The `/api/grade` endpoint accepts both PDFs and the rubric text.
- **OCR stage (Mistral Document AI)**: each PDF is processed with `mistral-ocr-latest` → markdown transcript. Low-confidence pages are rejected (with one retry).
- **Grading stage (OpenAI)**: the questions transcript, answers transcript, and rubric are sent to GPT-4.1-mini in one call. OpenAI aligns questions with student work and applies the rubric.
- The final score is computed deterministically as `max_score - sum(deductions)` (the grader's own score is overridden).
- The API returns the score, deductions, rationale, and both OCR transcripts to the frontend.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + TypeScript + Vite

## Environment variables

Create `backend/.env` (gitignored) with:

```
MISTRAL_API_KEY=...                        # Mistral Document OCR
OPENAI_API_KEY=...                         # grading (GPT-4.1-mini)
MISTRAL_OCR_MODEL=mistral-ocr-latest       # optional
MISTRAL_OCR_MIN_CONFIDENCE=0.80            # optional; min page-average (content pages only)
MISTRAL_OCR_MIN_PAGE_CHARS_FOR_CONFIDENCE=80  # optional; skip gate on near-blank pages
MISTRAL_OCR_MIN_PAGE_MINIMUM=0.50          # optional; also enforce page-minimum score
```

Both keys are required. Mistral OCR is billed per page when billing is active — see [Mistral billing](https://docs.mistral.ai/admin/user-management-finops/billing). New accounts may include free API credits before a card is required.

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
