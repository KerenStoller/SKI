import os
import time
from typing import Dict, Tuple, Optional

from dotenv import load_dotenv
from mistralai.client import Mistral
from mistralai.client.models import File, FileChunk

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("MISTRAL_API_KEY")
client = Mistral(api_key=API_KEY) if API_KEY else None

OCR_MODEL = os.getenv("MISTRAL_OCR_MODEL", "mistral-ocr-latest")
# Handwritten exams often score 0.80–0.84 on hard pages; 0.85 rejects good reads.
OCR_MIN_CONFIDENCE = float(os.getenv("MISTRAL_OCR_MIN_CONFIDENCE", "0.80"))
_min_page_min = os.getenv("MISTRAL_OCR_MIN_PAGE_MINIMUM")
OCR_MIN_PAGE_MINIMUM = float(_min_page_min) if _min_page_min else None
# Near-blank pages (back cover, spacer) have unreliable scores — skip gate.
OCR_MIN_CHARS_FOR_CONFIDENCE = int(
    os.getenv("MISTRAL_OCR_MIN_PAGE_CHARS_FOR_CONFIDENCE", "80")
)


def _upload_pdf(pdf_bytes: bytes, filename: str) -> str:
    """Upload a PDF for OCR; returns Mistral file id."""
    upload = client.files.upload(
        file=File(
            file_name=filename,
            content=pdf_bytes,
            content_type="application/pdf",
        ),
        purpose="ocr",
    )
    return upload.id


def _page_confidence_scores(page) -> Optional[Tuple[float, float]]:
    scores = getattr(page, "confidence_scores", None)
    if scores is None:
        return None
    return scores.average_page_confidence_score, scores.minimum_page_confidence_score


def _assert_confidence(
    label: str,
    pages,
    avg_threshold: float,
    min_threshold: Optional[float] = None,
) -> float:
    """
    Require every page's average confidence >= avg_threshold.
    Optionally also require minimum confidence >= min_threshold.
    """
    averages = []
    for page in pages:
        text = (page.markdown or "").strip()
        if len(text) < OCR_MIN_CHARS_FOR_CONFIDENCE:
            continue
        pair = _page_confidence_scores(page)
        if pair is None:
            continue
        avg, minimum = pair
        averages.append(avg)
        if avg < avg_threshold:
            raise RuntimeError(
                f"{label} OCR confidence too low on page {page.index + 1}: "
                f"average={avg:.3f} (threshold={avg_threshold})"
            )
        if min_threshold is not None and minimum < min_threshold:
            raise RuntimeError(
                f"{label} OCR confidence too low on page {page.index + 1}: "
                f"minimum={minimum:.3f} (threshold={min_threshold})"
            )
    if not averages:
        # Only near-blank pages or missing scores — do not block the run.
        return 0.0
    return min(averages)


def _ocr_pdf_to_markdown(pdf_bytes: bytes, label: str) -> str:
    """
    Run Mistral Document OCR on a PDF and return concatenated page markdown.
    Retries once on low confidence or transient errors.
    """
    max_attempts = 2
    retry_delay = 5
    last_error: Optional[Exception] = None

    for attempt in range(max_attempts):
        try:
            file_id = _upload_pdf(pdf_bytes, f"{label}.pdf")
            response = client.ocr.process(
                model=OCR_MODEL,
                document=FileChunk(file_id=file_id),
                confidence_scores_granularity="page",
                include_image_base64=False,
            )

            pages = sorted(response.pages, key=lambda p: p.index)
            _assert_confidence(label, pages, OCR_MIN_CONFIDENCE, OCR_MIN_PAGE_MINIMUM)

            parts = []
            for page in pages:
                parts.append(f"## Page {page.index + 1}\n\n{page.markdown.strip()}")
            return "\n\n".join(parts)

        except RuntimeError as e:
            last_error = e
            if "confidence too low" in str(e) and attempt < max_attempts - 1:
                time.sleep(retry_delay)
                continue
            break
        except Exception as e:
            last_error = e
            if "429" in str(e) and attempt < max_attempts - 1:
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            break

    raise RuntimeError(f"Failed to OCR {label} exam: {last_error}")


def ocr_single_pdf(pdf_bytes: bytes, label: str) -> str:
    """OCR a single PDF and return concatenated page markdown."""
    if client is None:
        raise RuntimeError("MISTRAL_API_KEY is not set")
    return _ocr_pdf_to_markdown(pdf_bytes, label)


def extract_exam_transcripts(empty_exam: bytes, solved_exam: bytes) -> Dict[str, str]:
    """
    OCR the empty and solved PDFs via Mistral Document AI.
    Returns markdown transcripts for questions (blank) and student answers (filled).
    """
    if client is None:
        raise RuntimeError("MISTRAL_API_KEY is not set")

    return {
        "questions_markdown": _ocr_pdf_to_markdown(empty_exam, "empty"),
        "answers_markdown": _ocr_pdf_to_markdown(solved_exam, "solved"),
    }
