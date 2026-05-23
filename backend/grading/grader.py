import os
import re
import json
from typing import Any, Dict

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

with open(os.path.join(os.path.dirname(__file__), "prompt.md"), "r") as f:
    PROMPT_TEMPLATE = f.read()


def build_prompt(
    rubric: str, questions_markdown: str, answers_markdown: str
) -> str:
    """Fill the prompt template with rubric and both OCR transcripts."""
    prompt = PROMPT_TEMPLATE.replace("[Insert rubric here]", rubric)
    prompt = prompt.replace(
        "[Insert questions transcript here]", questions_markdown
    )
    prompt = prompt.replace("[Insert answers transcript here]", answers_markdown)
    return prompt


def _strip_json_fences(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    return match.group(1) if match else text


def grade_exam(
    rubric: str, questions_markdown: str, answers_markdown: str
) -> Dict[str, Any]:
    """
    Grade an exam given the rubric and separate OCR transcripts for the
    blank exam (questions) and the solved exam (student work).
    """
    prompt = build_prompt(rubric, questions_markdown, answers_markdown)

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.2,
    )

    raw = response.choices[0].message.content
    result = json.loads(_strip_json_fences(raw))

    deductions = result.get("deductions") or []
    total_deductions = sum(d.get("points", 0) for d in deductions)
    max_score = result.get("max_score", 100)
    result["final_score"] = max(0, max_score - total_deductions)
    return result
