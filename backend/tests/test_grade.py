from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.grading import grader
from backend.main import app


class FakeMessage:
    def __init__(self, content):
        self.content = content


class FakeChoice:
    def __init__(self, content):
        self.message = FakeMessage(content)


class FakeResponse:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]


class FakeCompletions:
    def __init__(self, response):
        self._response = response

    def create(self, **kwargs):
        return self._response


class FakeChat:
    def __init__(self, response):
        self.completions = FakeCompletions(response)


class FakeClient:
    def __init__(self, response):
        self.chat = FakeChat(response)


@pytest.fixture()
def client():
    return TestClient(app)


SAMPLE_QUESTIONS = [
    {"question_number": 1, "question_text": "What is 2+2?", "student_answer": "4"},
    {"question_number": 2, "question_text": "Capital of France?", "student_answer": "Paris"},
]

SAMPLE_GRADING = {
    "final_score": 95.0,
    "max_score": 100.0,
    "rationale": "Strong work overall.",
    "deductions": [
        {"question_number": 2, "reason": "Missing detail", "points": 5.0},
    ],
}


def test_build_prompt_inserts_inputs():
    prompt = grader.build_prompt("Use evidence.", SAMPLE_QUESTIONS)

    assert "Use evidence." in prompt
    assert "What is 2+2?" in prompt
    assert "Paris" in prompt
    assert "[Insert rubric here]" not in prompt
    assert "[Insert questions and answers here]" not in prompt


def test_grade_exam_parses_json():
    fake_response = FakeResponse(
        '{"final_score": 95, "max_score": 100, "rationale": "Good", "deductions": []}'
    )

    with patch.object(grader, "client", FakeClient(fake_response)):
        result = grader.grade_exam("Rubric", SAMPLE_QUESTIONS)

    assert result["max_score"] == 100
    assert result["rationale"] == "Good"
    assert result["deductions"] == []
    # No deductions → score is max_score regardless of what GPT returned
    assert result["final_score"] == 100


def test_grade_exam_strips_json_fences():
    fake_response = FakeResponse(
        '```json\n{"final_score": 80, "max_score": 100, "rationale": "ok", "deductions": []}\n```'
    )

    with patch.object(grader, "client", FakeClient(fake_response)):
        result = grader.grade_exam("Rubric", SAMPLE_QUESTIONS)

    assert result["max_score"] == 100


def test_grade_exam_recomputes_final_score_from_deductions():
    # GPT says 75, but deductions sum to 15 → real score is max_score (100) - 15 = 85.
    fake_response = FakeResponse(
        '{"final_score": 75, "max_score": 100, "rationale": "ok", "deductions": ['
        '{"question_number": 1, "reason": "a", "points": 5},'
        '{"question_number": 2, "reason": "b", "points": 5},'
        '{"question_number": 3, "reason": "c", "points": 5}'
        ']}'
    )

    with patch.object(grader, "client", FakeClient(fake_response)):
        result = grader.grade_exam("Rubric", SAMPLE_QUESTIONS)

    assert result["final_score"] == 85


def test_grade_exam_floors_final_score_at_zero():
    # Deductions exceeding max_score must not produce a negative score.
    fake_response = FakeResponse(
        '{"final_score": -10, "max_score": 100, "rationale": "ok", "deductions": ['
        '{"question_number": 1, "reason": "a", "points": 150}'
        ']}'
    )

    with patch.object(grader, "client", FakeClient(fake_response)):
        result = grader.grade_exam("Rubric", SAMPLE_QUESTIONS)

    assert result["final_score"] == 0


def _post_grade(client, **overrides):
    files = {
        "empty_exam": overrides.get("empty_exam", ("empty.pdf", b"%PDF-1.4 empty", "application/pdf")),
        "solved_exam": overrides.get("solved_exam", ("solved.pdf", b"%PDF-1.4 solved", "application/pdf")),
    }
    data = {"rubric": overrides.get("rubric", "Grade fairly.")}
    return client.post("/api/grade", files=files, data=data)


def test_grade_endpoint_returns_grading(client):
    with patch("backend.api.grade.extract_answers", return_value=SAMPLE_QUESTIONS), \
         patch("backend.api.grade.grade_exam", return_value=SAMPLE_GRADING):
        response = _post_grade(client)

    assert response.status_code == 200
    assert response.json() == {**SAMPLE_GRADING, "extracted_questions": SAMPLE_QUESTIONS}


def test_grade_endpoint_rejects_non_pdf(client):
    response = _post_grade(
        client,
        empty_exam=("empty.txt", b"not a pdf", "text/plain"),
    )

    assert response.status_code == 400
    assert "empty_exam" in response.json()["detail"]


def test_grade_endpoint_rejects_empty_rubric(client):
    response = _post_grade(client, rubric="   ")

    assert response.status_code == 400
    assert "rubric" in response.json()["detail"]


def test_grade_endpoint_returns_502_when_ocr_fails(client):
    with patch("backend.api.grade.extract_answers", side_effect=RuntimeError("mistral down")):
        response = _post_grade(client)

    assert response.status_code == 502
    assert "mistral down" in response.json()["detail"]


def test_grade_endpoint_returns_502_when_grading_fails(client):
    with patch("backend.api.grade.extract_answers", return_value=SAMPLE_QUESTIONS), \
         patch("backend.api.grade.grade_exam", side_effect=RuntimeError("openai down")):
        response = _post_grade(client)

    assert response.status_code == 502
    assert "openai down" in response.json()["detail"]
