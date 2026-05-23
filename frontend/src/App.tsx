import { useEffect, useMemo, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";

type Deduction = {
  question_number: number;
  reason: string;
  points: number;
};

type OcrTranscripts = {
  questions_markdown: string;
  answers_markdown: string;
};

type GradingResult = {
  final_score: number;
  max_score: number;
  rationale: string;
  deductions: Deduction[];
  ocr_transcripts: OcrTranscripts;
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8002";

function App() {
  const [health, setHealth] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [emptyExam, setEmptyExam] = useState<File | null>(null);
  const [solvedExam, setSolvedExam] = useState<File | null>(null);
  const [rubric, setRubric] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradingResult | null>(null);

  const [showDeductions, setShowDeductions] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error("Backend is unavailable");
        return res.json();
      })
      .then((data) => setHealth(data.status))
      .catch((err) => setHealthError(err.message));
  }, []);

  const solvedPdfUrl = useMemo(() => {
    if (!solvedExam) return "";
    return URL.createObjectURL(solvedExam);
  }, [solvedExam]);

  const handleFileChange =
    (setter: (file: File | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file only.");
        return;
      }
      setter(file);
    };

  const canSubmit =
    !!emptyExam && !!solvedExam && rubric.trim().length > 0 && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !emptyExam || !solvedExam) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("empty_exam", emptyExam);
    formData.append("solved_exam", solvedExam);
    formData.append("rubric", rubric);

    try {
      const res = await fetch(`${BACKEND_URL}/api/grade`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Request failed (${res.status})`);
      }
      const data: GradingResult = await res.json();
      setResult(data);
      setShowDeductions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const totalDeduction =
    result?.deductions.reduce((sum, d) => sum + d.points, 0) ?? 0;

  return (
    <div className="page" dir="ltr">
      <div className="background-shape background-shape-one"></div>
      <div className="background-shape background-shape-two"></div>

      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="AutoGrade Logo" className="brand-logo" />
          <div className="brand-text">
            <h1>AutoGrade</h1>
            <p>Smart grading, happy teaching</p>
          </div>
        </div>

        <div className="status-badge">
          <span className="status-label">Backend Status</span>
          {health ? (
            <span className="status-ok">{health}</span>
          ) : healthError ? (
            <span className="status-error">Offline</span>
          ) : (
            <span className="status-loading">Checking...</span>
          )}
        </div>
      </header>

      <main className="dashboard">
        <section className="left-column">
          <form className="panel upload-panel" onSubmit={handleSubmit}>
            <h2>Upload Exam</h2>
            <p className="panel-subtitle">
              Upload the blank and solved exam PDFs and provide a rubric.
            </p>

            <label className="upload-dropzone">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange(setEmptyExam)}
              />
              <span className="upload-title">Empty Exam (PDF)</span>
              <span className="upload-hint">
                {emptyExam ? emptyExam.name : "Click to upload the blank exam"}
              </span>
            </label>

            <label className="upload-dropzone">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange(setSolvedExam)}
              />
              <span className="upload-title">Solved Exam (PDF)</span>
              <span className="upload-hint">
                {solvedExam ? solvedExam.name : "Click to upload the student's exam"}
              </span>
            </label>

            <label className="rubric-field">
              <span className="rubric-label">Rubric</span>
              <textarea
                className="rubric-textarea"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="Paste the grading rubric here..."
                rows={6}
              />
            </label>

            <button
              type="submit"
              className="main-button"
              disabled={!canSubmit}
            >
              {loading ? "Grading..." : "Grade Exam"}
            </button>

            {error && <div className="error-banner">{error}</div>}
          </form>

          <div className="panel score-panel">
            <div className="score-header">
              <div>
                <h2>Final Grade</h2>
                <p className="panel-subtitle">
                  {result
                    ? `Score out of ${result.max_score}`
                    : "Upload an exam and click Grade to see the result"}
                </p>
              </div>
              <div className="score-circle">
                {result ? result.final_score : "—"}
              </div>
            </div>

            {result && (
              <>
                <button
                  type="button"
                  className="main-button"
                  onClick={() => setShowDeductions((prev) => !prev)}
                >
                  {showDeductions ? "Hide Deductions" : "Show Deductions"}
                </button>

                {showDeductions && (
                  <div className="deductions-card">
                    <div className="deductions-header">
                      <h3>Score Deductions</h3>
                      <span className="deductions-total">
                        -{totalDeduction} pts
                      </span>
                    </div>

                    <div className="deductions-list">
                      {result.deductions.length === 0 ? (
                        <p>No deductions — full marks.</p>
                      ) : (
                        result.deductions.map((d, i) => (
                          <div key={i} className="deduction-row">
                            <span>
                              <strong>Q{d.question_number}:</strong> {d.reason}
                            </span>
                            <strong>-{d.points}</strong>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel comments-panel">
            <h2>Teacher Notes</h2>
            <p className="panel-subtitle">Overall feedback for the student</p>

            <div className="comments-list">
              {result ? (
                <div className="comment-card">{result.rationale}</div>
              ) : (
                <div className="comment-card placeholder">
                  Grading rationale will appear here after the exam is graded.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="right-column">
          <div className="panel viewer-panel">
            <div className="viewer-header">
              <div>
                <h2>Exam Preview</h2>
                <p className="panel-subtitle">
                  Preview of the student's solved exam
                </p>
              </div>
            </div>

            {!solvedExam ? (
              <div className="empty-viewer">
                <img src={logo} alt="AutoGrade" className="empty-logo" />
                <h3>No Solved Exam Yet</h3>
                <p>Upload the solved exam to preview it here.</p>
              </div>
            ) : (
              <div className="pdf-frame-wrapper">
                <iframe
                  title="Solved Exam Preview"
                  src={solvedPdfUrl}
                  className="pdf-frame"
                />
              </div>
            )}
          </div>

          {result && (
            <div className="panel ocr-panel">
              <div className="viewer-header">
                <div>
                  <h2>What the OCR Read</h2>
                  <p className="panel-subtitle">
                    Compare with the PDF above to verify the grading is based on the right text.
                  </p>
                </div>
                <button
                  type="button"
                  className="main-button"
                  onClick={() => setShowOcr((prev) => !prev)}
                >
                  {showOcr ? "Hide" : "Show"}
                </button>
              </div>

              {showOcr && (
                <div className="ocr-list">
                  <div className="ocr-item">
                    <h4>Empty exam (questions)</h4>
                    <pre className="ocr-text">
                      {result.ocr_transcripts.questions_markdown || "(empty)"}
                    </pre>
                  </div>
                  <div className="ocr-item">
                    <h4>Solved exam (student answers)</h4>
                    <pre className="ocr-text">
                      {result.ocr_transcripts.answers_markdown || "(empty)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
