from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.api.gpt import gpt_grader
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


def test_build_prompt_inserts_inputs():
    prompt = gpt_grader.build_prompt("Use evidence.", "My answer")

    assert "Use evidence." in prompt
    assert "My answer" in prompt
    assert "[Insert rubric here]" not in prompt
    assert "[Insert student answer here]" not in prompt


def test_grade_answer_parses_json():
    fake_response = FakeResponse('{"score": 4.5, "max_score": 5, "rationale": "Strong answer."}')

    with patch.object(gpt_grader, "client", FakeClient(fake_response)):
        result = gpt_grader.grade_answer("Rubric", "Answer")

    assert result["score"] == 4.5
    assert result["max_score"] == 5
    assert result["rationale"] == "Strong answer."


def test_grade_endpoint_returns_grading_result(client):
    with patch("backend.api.grade.grade_answer", return_value={
        "score": 3.0,
        "max_score": 4.0,
        "rationale": "Good work.",
    }):
        response = client.post(
            "/api/grade",
            json={"rubric": "Rubric text", "student_answer": "Answer text"},
        )

    assert response.status_code == 200
    assert response.json()["score"] == 3.0
    assert response.json()["max_score"] == 4.0
    assert response.json()["rationale"] == "Good work."


def test_grade_endpoint_returns_500_when_grading_fails(client):
    with patch("backend.api.grade.grade_answer", return_value={"error": "bad request"}):
        response = client.post(
            "/api/grade",
            json={"rubric": "Rubric text", "student_answer": "Answer text"},
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "bad request"