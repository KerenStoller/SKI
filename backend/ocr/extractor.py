import os
import re
import io
import time
import json
import base64
from typing import List, Dict, Any

import fitz  # PyMuPDF
from PIL import Image
from dotenv import load_dotenv
from mistralai.client import Mistral

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("MISTRAL_API_KEY")
client = Mistral(api_key=API_KEY) if API_KEY else None

with open(os.path.join(os.path.dirname(__file__), "prompt.md"), "r") as f:
    PROMPT = f.read()


def pdf_bytes_to_base64_image(pdf_bytes: bytes) -> str:
    """
    Render every page of a PDF and stitch them vertically into a single
    base64-encoded PNG. One image per PDF keeps us under Mistral's
    8-image-per-call limit regardless of page count.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    # Matrix(2, 2) renders at 2x for clearer handwriting; payload stays under free-tier caps.
    # Tried (3, 3) — Mistral hallucinates more, likely a size/token limit issue.
    page_images = [
        Image.open(io.BytesIO(page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")))
        for page in doc
    ]
    doc.close()

    width = max(img.width for img in page_images)
    height = sum(img.height for img in page_images)
    stitched = Image.new("RGB", (width, height), "white")
    y = 0
    for img in page_images:
        stitched.paste(img, (0, y))
        y += img.height

    buf = io.BytesIO()
    stitched.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _strip_outer_json_fences(text: str) -> str:
    """
    Strip ```json ... ``` fences only at the very start/end of the response.
    Internal fences (inside transcribed code blocks) are left intact.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text


def _image_part(b64: str) -> Dict[str, Any]:
    return {"type": "image_url", "image_url": f"data:image/png;base64,{b64}"}


def extract_answers(empty_exam: bytes, solved_exam: bytes) -> List[Dict[str, Any]]:
    """
    Send the empty and solved exam PDFs to Mistral in a single vision call and
    return a list of {question_number, question_text, student_answer} dicts.
    """
    empty_image = pdf_bytes_to_base64_image(empty_exam)
    solved_image = pdf_bytes_to_base64_image(solved_exam)

    content: List[Dict[str, Any]] = [
        {"type": "text", "text": PROMPT},
        {"type": "text", "text": "EMPTY EXAM (questions only):"},
        _image_part(empty_image),
        {"type": "text", "text": "SOLVED EXAM (student's filled-in answers):"},
        _image_part(solved_image),
    ]

    max_retries = 3
    retry_delay = 5
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = client.chat.complete(
                model="pixtral-12b-2409",
                messages=[{"role": "user", "content": content}],
                temperature=0,
            )
            raw = response.choices[0].message.content
            return json.loads(_strip_outer_json_fences(raw))
        except json.JSONDecodeError as e:
            last_error = e
            break
        except Exception as e:
            last_error = e
            if "429" in str(e) and attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            break

    raise RuntimeError(f"Failed to extract answers from Mistral: {last_error}")
