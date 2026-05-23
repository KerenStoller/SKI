"""
Smoke-test Mistral Document OCR on student1.pdf.

Usage (from repo root):
  python backend/scripts/test_mistral_ocr.py
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.ocr.extractor import (
    extract_exam_transcripts,
    OCR_MIN_CONFIDENCE,
    OCR_MODEL,
)

EXAMS = ROOT / "test_exams"
EMPTY = (EXAMS / "unanswered.pdf").read_bytes()
SOLVED = (EXAMS / "student1.pdf").read_bytes()


def main():
    print(f"OCR model: {OCR_MODEL}")
    print(f"Min confidence: {OCR_MIN_CONFIDENCE}")
    t0 = time.time()
    try:
        transcripts = extract_exam_transcripts(EMPTY, SOLVED)
    except Exception as e:
        print(f"FAILED ({time.time() - t0:.1f}s): {e}")
        sys.exit(1)

    q_len = len(transcripts["questions_markdown"])
    a_len = len(transcripts["answers_markdown"])
    print(f"OK ({time.time() - t0:.1f}s) — questions={q_len} chars, answers={a_len} chars")
    print("\n--- questions (first 400 chars) ---")
    print(transcripts["questions_markdown"][:400])
    print("\n--- answers (first 400 chars) ---")
    print(transcripts["answers_markdown"][:400])


if __name__ == "__main__":
    main()
