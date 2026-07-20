/// <reference types="vite/client" />

import { useCallback, useEffect, useMemo, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

type Deduction = {
  question_number: number;
  reason: string;
  points: number;
};

type GradingRun = {
  id: number;
  student_number: string;
  file_path: string | null;
  final_score: number;
  max_score: number;
  rationale?: string;
  deductions?: Deduction[];
  created_at: string | null;
  ocr_transcripts?: {
    questions_markdown: string;
    answers_markdown: string;
  };
};

type ProjectDetail = {
  id: number;
  name: string;
  rubric: string;
  empty_exam_path: string | null;
  created_at: string | null;
  runs: GradingRun[];
};

type GradeResult = GradingRun;

type BulkEntry = {
  file: File;
  studentNumber: string;
  status: "pending" | "processing" | "done" | "error";
  result?: GradeResult;
  error?: string;
};

interface ProjectViewProps {
  token: string;
  projectId: number;
  projectName: string;
  onBack: () => void;
  onLogout: () => void;
}

function GradingLoader({ label }: { label?: string }) {
  return (
    <div className="grading-loader">
      <div className="grading-dots">
        <span className="grading-dot" />
        <span className="grading-dot" />
        <span className="grading-dot" />
      </div>
      {label && <span className="grading-loader-label">{label}</span>}
    </div>
  );
}

export default function ProjectView({
  token,
  projectId,
  projectName,
  onBack,
  onLogout,
}: ProjectViewProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [studentNumber, setStudentNumber] = useState("");
  const [solvedExam, setSolvedExam] = useState<File | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [showDeductions, setShowDeductions] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      if (res.status === 401) {
        onLogout();
        throw new Error("Token expired");
      }
      return res;
    },
    [token, onLogout]
  );

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const data: ProjectDetail = await res.json();
      setProject(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const solvedPdfUrl = useMemo(() => {
    if (!solvedExam) return "";
    return URL.createObjectURL(solvedExam);
  }, [solvedExam]);

  useEffect(() => {
    return () => {
      if (solvedPdfUrl) URL.revokeObjectURL(solvedPdfUrl);
    };
  }, [solvedPdfUrl]);

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solvedExam || !studentNumber.trim()) return;
    setGrading(true);
    setGradeError(null);
    setGradeResult(null);
    setShowDeductions(false);

    const formData = new FormData();
    formData.append("student_number", studentNumber.trim());
    formData.append("solved_exam", solvedExam);

    try {
      const res = await authFetch(`${BACKEND_URL}/api/projects/${projectId}/grade`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "בדיקה נכשלה");
      }
      const data: GradeResult = await res.json();
      setGradeResult(data);
      setShowDeductions(true);
      // Refresh project to update runs list
      setProject((prev) =>
        prev ? { ...prev, runs: [data, ...prev.runs] } : prev
      );
      setStudentNumber("");
      setSolvedExam(null);
    } catch (err: any) {
      setGradeError(err.message);
    } finally {
      setGrading(false);
    }
  };

  const handleBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type === "application/pdf");
    setBulkEntries(files.map((file) => ({ file, studentNumber: "", status: "pending" })));
  };

  const handleBulkGrade = async () => {
    if (bulkRunning) return;
    setBulkRunning(true);
    const entries = [...bulkEntries];
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].studentNumber.trim()) continue;
      entries[i] = { ...entries[i], status: "processing" };
      setBulkEntries([...entries]);

      const formData = new FormData();
      formData.append("student_number", entries[i].studentNumber.trim());
      formData.append("solved_exam", entries[i].file);
      try {
        const res = await authFetch(`${BACKEND_URL}/api/projects/${projectId}/grade`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || "בדיקה נכשלה");
        }
        const data: GradeResult = await res.json();
        entries[i] = { ...entries[i], status: "done", result: data };
        setProject((prev) => prev ? { ...prev, runs: [data, ...prev.runs] } : prev);
      } catch (err: any) {
        entries[i] = { ...entries[i], status: "error", error: err.message };
      }
      setBulkEntries([...entries]);
    }
    setBulkRunning(false);
  };

  const totalDeduction =
    gradeResult?.deductions?.reduce((sum, d) => sum + d.points, 0) ?? 0;

  const canGrade = studentNumber.trim().length > 0 && !!solvedExam && !grading;

  return (
    <main className="dashboard">
      <section className="left-column">
        {/* Header / back */}
        <div className="panel upload-panel">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <button
              type="button"
              className="main-button"
              onClick={onBack}
              style={{ width: "auto", padding: "8px 14px", backgroundColor: "#64748b" }}
            >
              ← חזרה לפרויקטים
            </button>
            <h2 style={{ margin: 0 }}>{projectName}</h2>
          </div>
          <p className="panel-subtitle">
            {loading
              ? "טוען..."
              : `${project?.runs.length ?? 0} תלמידים נבדקו בפרויקט זה`}
          </p>
        </div>

        {/* Grade new student form */}
        <div className="panel upload-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ margin: 0 }}>בדיקת תלמיד/ה</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="main-button"
                onClick={() => { setBulkMode(false); setBulkEntries([]); }}
                style={{ width: "auto", padding: "6px 14px", backgroundColor: !bulkMode ? "#3b82f6" : "#94a3b8" }}
              >
                יחיד/ה
              </button>
              <button
                type="button"
                className="main-button"
                onClick={() => setBulkMode(true)}
                style={{ width: "auto", padding: "6px 14px", backgroundColor: bulkMode ? "#3b82f6" : "#94a3b8" }}
              >
                העלאה מרובה
              </button>
            </div>
          </div>

          {!bulkMode ? (
            <form onSubmit={handleGrade}>
              <p className="panel-subtitle">העלה/י את המבחן הפתור ורשום/י מספר תלמיד.</p>
              <label className="rubric-field">
                <span className="rubric-label">מספר תלמיד</span>
                <input
                  className="rubric-textarea"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="לדוגמה: 315589"
                  style={{ height: "40px" }}
                  required
                />
              </label>
              <label className="upload-dropzone" style={{ marginTop: "12px" }}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.type !== "application/pdf") { alert("נא להעלות קובץ PDF בלבד."); return; }
                    setSolvedExam(f ?? null);
                  }}
                />
                <span className="upload-title">מבחן פתור (PDF)</span>
                <span className="upload-hint">{solvedExam ? solvedExam.name : "לחץ/י להעלאת המבחן הסרוק"}</span>
              </label>
              {gradeError && <div className="error-banner">{gradeError}</div>}
              {grading && <GradingLoader label="סורק ובודק..." />}
              <button type="submit" className="main-button" disabled={!canGrade} style={{ marginTop: "12px" }}>
                {grading ? "בודק..." : "בדוק מבחן"}
              </button>
            </form>
          ) : (
            <div>
              <p className="panel-subtitle">בחר/י מספר קבצי PDF — אחד לכל תלמיד — ורשום/י מספר תלמיד לכל אחד.</p>
              <label className="upload-dropzone" style={{ marginBottom: "16px" }}>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleBulkFilesChange}
                  disabled={bulkRunning}
                />
                <span className="upload-title">מבחנים פתורים (PDF)</span>
                <span className="upload-hint">
                  {bulkEntries.length > 0 ? `${bulkEntries.length} קבצים נבחרו` : "לחץ/י לבחירת קבצים מרובים"}
                </span>
              </label>

              {bulkRunning && <GradingLoader label="סורק ובודק..." />}
              {bulkEntries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                  {bulkEntries.map((entry, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "1.1rem" }}>
                        {entry.status === "pending" ? "📄" : entry.status === "processing" ? "⏳" : entry.status === "done" ? "✅" : "❌"}
                      </span>
                      <span style={{ flex: 1, fontSize: "0.85rem", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.file.name}
                      </span>
                      {entry.status === "done" && entry.result ? (
                        <span style={{ fontWeight: "bold", color: entry.result.final_score / entry.result.max_score >= 0.6 ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
                          {entry.result.final_score}/{entry.result.max_score}
                        </span>
                      ) : entry.status === "error" ? (
                        <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>{entry.error}</span>
                      ) : (
                        <input
                          className="rubric-textarea"
                          value={entry.studentNumber}
                          onChange={(e) => {
                            const updated = [...bulkEntries];
                            updated[i] = { ...updated[i], studentNumber: e.target.value };
                            setBulkEntries(updated);
                          }}
                          placeholder="מספר תלמיד"
                          style={{ height: "34px", width: "130px" }}
                          disabled={bulkRunning}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const totalToGrade = bulkEntries.filter((e) => e.studentNumber.trim()).length;
                const doneCount = bulkEntries.filter((e) => e.status === "done" || e.status === "error").length;
                const allDone = totalToGrade > 0 && doneCount === totalToGrade && !bulkRunning;
                return (
                  <button
                    type="button"
                    className="main-button"
                    disabled={bulkRunning || bulkEntries.length === 0 || bulkEntries.every((e) => !e.studentNumber.trim()) || allDone}
                    onClick={handleBulkGrade}
                  >
                    {allDone ? `הושלם — ${doneCount} מבחנים נבדקו` : `בדוק ${totalToGrade} מבחנים`}
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Grade result */}
        {gradeResult && (
          <>
            <div className="panel score-panel">
              <div className="score-header">
                <div>
                  <h2>ציון סופי — תלמיד {gradeResult.student_number}</h2>
                  <p className="panel-subtitle">ציון מתוך {gradeResult.max_score}</p>
                </div>
                <div className="score-circle">{gradeResult.final_score}</div>
              </div>

              <button
                type="button"
                className="main-button"
                onClick={() => setShowDeductions((v) => !v)}
              >
                {showDeductions ? "הסתרת הורדות" : "הצגת הורדות"}
              </button>

              {showDeductions && (
                <div className="deductions-card">
                  <div className="deductions-header">
                    <h3>הורדות ניקוד</h3>
                    <span className="deductions-total">-{totalDeduction} נק׳</span>
                  </div>
                  <div className="deductions-list">
                    {!gradeResult.deductions || gradeResult.deductions.length === 0 ? (
                      <p>אין הורדות — ניקוד מלא.</p>
                    ) : (
                      gradeResult.deductions.map((d, i) => (
                        <div key={i} className="deduction-row">
                          <span>
                            <strong>שאלה {d.question_number}:</strong> {d.reason}
                          </span>
                          <strong>-{d.points}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="panel comments-panel">
              <h2>הערות למורה</h2>
              <div className="comments-list">
                <div className="comment-card">{gradeResult.rationale ?? "—"}</div>
              </div>
            </div>
          </>
        )}

        {/* Past runs */}
        <div className="panel comments-panel">
          <h2>תלמידים שנבדקו</h2>
          <p className="panel-subtitle">
            {project?.runs.length === 0 ? "אין בדיקות עדיין." : `${project?.runs.length ?? 0} בדיקות`}
          </p>
          <div className="comments-list">
            {loading ? (
              <div className="comment-card placeholder">טוען...</div>
            ) : !project || project.runs.length === 0 ? (
              <div className="comment-card placeholder">
                עדיין לא נבדקו תלמידים בפרויקט זה.
              </div>
            ) : (
              project.runs.map((r) => (
                <div key={r.id} className="comment-card">
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                  >
                    <div>
                      <strong>תלמיד {r.student_number}</strong>
                      {r.created_at && (
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "2px" }}>
                          {new Date(r.created_at).toLocaleDateString("he-IL")}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        color: r.final_score / r.max_score >= 0.6 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {r.final_score}/{r.max_score}
                    </div>
                  </div>

                  {expandedRun === r.id && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                      {r.rationale && (
                        <p style={{ fontSize: "0.9rem", color: "#475569" }}>{r.rationale}</p>
                      )}
                      {r.deductions && r.deductions.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          {r.deductions.map((d, i) => (
                            <div key={i} className="deduction-row">
                              <span>
                                <strong>שאלה {d.question_number}:</strong> {d.reason}
                              </span>
                              <strong>-{d.points}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.file_path && (
                        <a
                          href={r.file_path}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "block", marginTop: "10px", color: "#3b82f6", fontSize: "0.9rem" }}
                        >
                          📄 פתח מבחן סרוק (PDF)
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="right-column">
        {/* PDF preview */}
        <div className="panel viewer-panel">
          <div className="viewer-header">
            <div>
              <h2>תצוגה מקדימה</h2>
              <p className="panel-subtitle">תצוגה של המבחן הפתור שהועלה</p>
            </div>
          </div>
          {!solvedExam ? (
            <div className="empty-viewer">
              <h3>לא הועלה מבחן פתור</h3>
              <p>העלה/י מבחן כדי לראות תצוגה מקדימה.</p>
            </div>
          ) : (
            <div className="pdf-frame-wrapper">
              <iframe title="תצוגה מקדימה" src={solvedPdfUrl} className="pdf-frame" />
            </div>
          )}
        </div>

        {/* OCR panel */}
        {gradeResult?.ocr_transcripts && (
          <div className="panel ocr-panel">
            <div className="viewer-header">
              <div>
                <h2>מה ה־OCR זיהה</h2>
                <p className="panel-subtitle">השווי מול ה־PDF כדי לוודא שהבדיקה מבוססת על הטקסט הנכון.</p>
              </div>
              <button
                type="button"
                className="main-button"
                onClick={() => setShowOcr((v) => !v)}
              >
                {showOcr ? "הסתרה" : "הצגה"}
              </button>
            </div>
            {showOcr && (
              <div className="ocr-list">
                <div className="ocr-item">
                  <h4>מבחן ריק (שאלות)</h4>
                  <pre className="ocr-text">
                    {gradeResult.ocr_transcripts.questions_markdown || "(ריק)"}
                  </pre>
                </div>
                <div className="ocr-item">
                  <h4>מבחן פתור (תשובות)</h4>
                  <pre className="ocr-text">
                    {gradeResult.ocr_transcripts.answers_markdown || "(ריק)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
