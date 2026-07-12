# AutoGrade 📝

> **Note:** This document describes the proof-of-concept (POC) plan only — not a final product or full production architecture.

AutoGrade is a web app for uploading an empty exam, a solved exam, and a rubric at once, grading them through a two-stage AI pipeline, and managing them in a dynamic cloud workspace.

## 🌊 Flow

- **Upload:** Submit an empty exam, a solved exam, and a rubric, assigning them to a specific class folder and student ID.
- **API Routing:** The /api/grade endpoint accepts the PDFs, rubric text, and workspace metadata.
- **OCR Stage (Mistral Document AI):** Each PDF is processed with mistral-ocr-latest → markdown transcript. Low-confidence pages are rejected (with one retry).
- **Grading Stage (OpenAI):** The questions transcript, answers transcript, and rubric are sent to GPT-4o-mini in one call. OpenAI aligns questions with student work and applies the rubric.
- **Deterministic Math:** The final score is computed deterministically as max_score - sum(deductions) (the LLM's own score math is overridden to prevent hallucinations).
- **Cloud Archiving:** The uploaded PDFs are routed directly to Supabase Storage using dynamically generated virtual class folders (with URL-safe encoding for Hebrew characters).
- **Dashboard UI:** The API returns the score, deductions, rationale, OCR transcripts, and the cloud file link. The frontend dashboard displays the test history organized interactively by these class folders.

## 🛠️ Stack

- **Backend:** Python + FastAPI
- **Frontend:** React + TypeScript + Vite
- **Database:** PostgreSQL (SQLAlchemy + JSONB payloads)
- **Storage:** Supabase Storage (Cloud PDF hosting)

## 🔐 Environment Variables

Create a `backend/.env` file (ensure this is gitignored) with the following credentials:

```env
# AI Keys
MISTRAL_API_KEY=your_mistral_key              # Mistral Document OCR
OPENAI_API_KEY=your_openai_key                # Grading (GPT-4o-mini)

# Optional Mistral Settings
MISTRAL_OCR_MODEL=mistral-ocr-latest          # optional
MISTRAL_OCR_MIN_CONFIDENCE=0.80               # optional; min page-average
MISTRAL_OCR_MIN_PAGE_CHARS_FOR_CONFIDENCE=80  # optional; skip gate on near-blank pages
MISTRAL_OCR_MIN_PAGE_MINIMUM=0.50             # optional; also enforce page-minimum score

# Database & Storage
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/autograde
SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
SUPABASE_KEY=your_service_role_key            # Requires Service Role key to bypass RLS for uploads