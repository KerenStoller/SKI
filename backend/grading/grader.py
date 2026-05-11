import os
import re
import json
from typing import Any, Dict, List

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

with open(os.path.join(os.path.dirname(__file__), 'prompt.md'), 'r') as f:
    PROMPT_TEMPLATE = f.read()


def build_prompt(rubric: str, questions: List[Dict[str, Any]]) -> str:
    """Fill the prompt template with the rubric and extracted questions."""
    questions_json = json.dumps(questions, ensure_ascii=False, indent=2)
    prompt = PROMPT_TEMPLATE.replace('[Insert rubric here]', rubric)
    prompt = prompt.replace('[Insert questions and answers here]', questions_json)
    return prompt


def _strip_json_fences(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    return match.group(1) if match else text


def grade_exam(rubric: str, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Grade an exam given the rubric and the list of {question_number,
    question_text, student_answer} extracted by the OCR step.
    """
    prompt = build_prompt(rubric, questions)

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.2,
    )

    raw = response.choices[0].message.content
    result = json.loads(_strip_json_fences(raw))

    # Final score is the source of truth: max_score minus the sum of deductions.
    # GPT's own final_score is overridden — it can't be trusted to add correctly.
    deductions = result.get("deductions") or []
    total_deductions = sum(d.get("points", 0) for d in deductions)
    max_score = result.get("max_score", 100)
    result["final_score"] = max(0, max_score - total_deductions)
    return result
