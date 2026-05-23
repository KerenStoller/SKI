from unittest.mock import MagicMock, patch

import pytest

from backend.ocr import extractor


def _page(markdown: str, avg: float = 0.95, minimum: float = 0.90, index: int = 0):
    page = MagicMock()
    page.index = index
    page.markdown = markdown
    scores = MagicMock()
    scores.average_page_confidence_score = avg
    scores.minimum_page_confidence_score = minimum
    page.confidence_scores = scores
    return page


def _ocr_response(*pages):
    response = MagicMock()
    response.pages = list(pages)
    return response


@patch.object(extractor, "client")
def test_extract_exam_transcripts(mock_client):
    mock_client.files.upload.return_value = MagicMock(id="file-1")
    long_q = "Question 1\nWrite isSorted\n" + ("// prompt text\n" * 10)
    long_a = "public static boolean isSorted(int[] arr) {\n" + ("  return true;\n" * 10)
    mock_client.ocr.process.side_effect = [
        _ocr_response(_page(long_q)),
        _ocr_response(_page(long_a)),
    ]

    result = extractor.extract_exam_transcripts(b"%PDF-empty", b"%PDF-solved")

    assert "Question 1" in result["questions_markdown"]
    assert "isSorted" in result["answers_markdown"]
    assert mock_client.ocr.process.call_count == 2
    mock_client.chat.complete.assert_not_called()


@patch.object(extractor, "client")
def test_ocr_rejects_low_confidence(mock_client):
    mock_client.files.upload.return_value = MagicMock(id="file-1")
    mock_client.ocr.process.return_value = _ocr_response(
        _page("x" * 100, avg=0.5, minimum=0.4)
    )

    with pytest.raises(RuntimeError, match="average="):
        extractor.extract_exam_transcripts(b"%PDF-empty", b"%PDF-solved")


@patch.object(extractor, "client")
def test_ocr_skips_confidence_on_near_blank_page(mock_client):
    mock_client.files.upload.return_value = MagicMock(id="file-1")
    mock_client.ocr.process.return_value = _ocr_response(
        _page("x" * 100, avg=0.95),
        _page("]", avg=0.40),  # blank-ish page would fail if gated
    )

    result = extractor.extract_exam_transcripts(b"%PDF-empty", b"%PDF-solved")

    assert "answers_markdown" in result
