import { useEffect, useMemo, useState } from "react";
import "./App.css";
import logo from "./assets/logo.png";

type DeductionItem = {
  id: number;
  reason: string;
  points: number;
};

type CommentItem = {
  id: number;
  text: string;
};

function App() {
  const [health, setHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [showDeductions, setShowDeductions] = useState(false);

  const [finalScore] = useState<number>(87);

  const [deductions] = useState<DeductionItem[]>([
    { id: 1, reason: "Incomplete explanation in Question 1", points: 5 },
    { id: 2, reason: "Missing detail in Question 3", points: 4 },
    { id: 3, reason: "Minor mistake in Question 5", points: 4 },
  ]);

  const [comments] = useState<CommentItem[]>([
    { id: 1, text: "Good direction in Question 1, but the explanation is incomplete." },
    { id: 2, text: "Question 3 shows understanding, but the final answer is not fully developed." },
    { id: 3, text: "Question 5 contains a small mistake that affects the final result." },
  ]);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8002";
    fetch(`${backendUrl}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Backend is unavailable");
        }

        return res.json();
      })
      .then((data) => setHealth(data.status))
      .catch((err) => setError(err.message));
  }, []);

  const pdfUrl = useMemo(() => {
    if (!pdfFile) {
      return "";
    }

    return URL.createObjectURL(pdfFile);
  }, [pdfFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      return;
    }

    setPdfFile(file);
  };

  const totalDeduction = deductions.reduce((sum, item) => sum + item.points, 0);

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
          ) : error ? (
            <span className="status-error">Offline</span>
          ) : (
            <span className="status-loading">Checking...</span>
          )}
        </div>
      </header>

      <main className="dashboard">
        <section className="left-column">
          <div className="panel upload-panel">
            <h2>Upload Exam</h2>
            <p className="panel-subtitle">
              Upload a PDF exam file to preview it and display grading results.
            </p>

            <label className="upload-dropzone">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <span className="upload-title">Choose PDF File</span>
              <span className="upload-hint">Click here to upload your exam document</span>
            </label>

            {pdfFile && (
              <div className="selected-file">
                <span className="file-pill">PDF</span>
                <span className="file-name">{pdfFile.name}</span>
              </div>
            )}
          </div>

          <div className="panel score-panel">
            <div className="score-header">
              <div>
                <h2>Final Grade</h2>
                <p className="panel-subtitle">Overall result after automatic review</p>
              </div>
              <div className="score-circle">{finalScore}</div>
            </div>

            <button
              className="main-button"
              onClick={() => setShowDeductions((prev) => !prev)}
            >
              {showDeductions ? "Hide Deductions" : "Show Deductions"}
            </button>

            {showDeductions && (
              <div className="deductions-card">
                <div className="deductions-header">
                  <h3>Score Deductions</h3>
                  <span className="deductions-total">-{totalDeduction} pts</span>
                </div>

                <div className="deductions-list">
                  {deductions.map((item) => (
                    <div key={item.id} className="deduction-row">
                      <span>{item.reason}</span>
                      <strong>-{item.points}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel comments-panel">
            <h2>Teacher Notes</h2>
            <p className="panel-subtitle">Feedback and comments for the student</p>

            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-card">
                  {comment.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="right-column">
          <div className="panel viewer-panel">
            <div className="viewer-header">
              <div>
                <h2>Exam Preview</h2>
                <p className="panel-subtitle">
                  Uploaded exam will appear here in a readable preview window
                </p>
              </div>
            </div>

            {!pdfFile ? (
              <div className="empty-viewer">
                <img src={logo} alt="AutoGrade" className="empty-logo" />
                <h3>No PDF Uploaded Yet</h3>
                <p>Upload an exam file to preview the document here.</p>
              </div>
            ) : (
              <div className="pdf-frame-wrapper">
                <iframe
                  title="Exam PDF Preview"
                  src={pdfUrl}
                  className="pdf-frame"
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;