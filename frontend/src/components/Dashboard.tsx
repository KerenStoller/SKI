import { useCallback, useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";

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
  id?: number;
  exam_name?: string;
  final_score: number;
  max_score: number;
  rationale: string;
  deductions: Deduction[];
  ocr_transcripts: OcrTranscripts;
};

type HistoryItem = {
  id: number;
  exam_name: string;
  final_score: number;
  max_score: number;
};

interface DashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Dashboard({ token, username, onLogout }: DashboardProps) {
  const [health, setHealth] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [examName, setExamName] = useState("מבחן חדש");
  const [emptyExam, setEmptyExam] = useState<File | null>(null);
  const [solvedExam, setSolvedExam] = useState<File | null>(null);
  const [rubric, setRubric] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradingResult | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);

  const [showDeductions, setShowDeductions] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!token) {
        throw new Error("No token");
      }

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

  useEffect(() => {
    document.title = "AutoGrade";

    fetch(`${BACKEND_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error("השרת אינו זמין");
        return res.json();
      })
      .then((data) => setHealth(data.status))
      .catch((err) => setHealthError(err.message));
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchHistory = async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/items`);

        if (!res.ok) {
          throw new Error(`Failed to fetch history: ${res.status}`);
        }

        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("History fetch failed:", err);
      }
    };

    fetchHistory();
  }, [token, authFetch]);

  useEffect(() => {
    if (!token) return;

    const fetchUserCount = async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/admin/user-count`);

        if (!res.ok) {
          throw new Error(`Failed to fetch user count: ${res.status}`);
        }

        const data = await res.json();
        setUserCount(data.total_users);
      } catch (err) {
        console.error("User count fetch failed:", err);
        setUserCount(0);
      }
    };

    fetchUserCount();
  }, [token, authFetch]);

  const solvedPdfUrl = useMemo(() => {
    if (!solvedExam) return "";
    return URL.createObjectURL(solvedExam);
  }, [solvedExam]);

  useEffect(() => {
    return () => {
      if (solvedPdfUrl) {
        URL.revokeObjectURL(solvedPdfUrl);
      }
    };
  }, [solvedPdfUrl]);

  const handleFileChange =
    (setter: (file: File | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        alert("נא להעלות קובץ PDF בלבד.");
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
    formData.append("exam_name", examName);

    try {
      const res = await fetch(`${BACKEND_URL}/api/grade`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.status === 401) {
        onLogout();
        throw new Error("Token expired");
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `הבקשה נכשלה (${res.status})`);
      }

      const data: GradingResult = await res.json();

      setResult(data);
      setShowDeductions(true);

      setHistory((prev) => [
        {
          id: data.id ?? Date.now(),
          exam_name: data.exam_name ?? examName,
          final_score: data.final_score,
          max_score: data.max_score,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  };

  const totalDeduction =
    result?.deductions.reduce((sum, d) => sum + d.points, 0) ?? 0;

  return (
    <div className="page" dir="rtl">
      <div className="background-shape background-shape-one"></div>
      <div className="background-shape background-shape-two"></div>

      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="לוגו AutoGrade" className="brand-logo" />
          <div className="brand-text">
            <h1>AutoGrade</h1>
            <p>בדיקה חכמה, הוראה שמחה</p>
          </div>
        </div>

        <div className="status-badge">
          <span className="status-label">מערכת</span>

          {health ? (
            <span className="status-ok">שרת: {health}</span>
          ) : healthError ? (
            <span className="status-error">שרת לא מחובר</span>
          ) : (
            <span className="status-loading">בודק שרת...</span>
          )}

          <span className="status-ok">@{username}</span>
          <span className="status-label">
            משתמשים רשומים: {userCount ?? "..."}
          </span>

          <button type="button" className="logout-button" onClick={onLogout}>
            התנתק
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="left-column">
          <form className="panel upload-panel" onSubmit={handleSubmit}>
            <h2>העלאת מבחן</h2>
            <p className="panel-subtitle">
              העלי את קובץ המבחן הריק ואת קובץ המבחן הפתור, והוסיפי מחוון בדיקה.
            </p>

            <label className="rubric-field">
              <span className="rubric-label">שם המבחן</span>
              <input
                className="rubric-textarea"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="לדוגמה: מבחן מתמטיקה - כיתה ח"
              />
            </label>

            <label className="upload-dropzone">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange(setEmptyExam)}
              />
              <span className="upload-title">מבחן ריק (PDF)</span>
              <span className="upload-hint">
                {emptyExam ? emptyExam.name : "לחצי להעלאת המבחן הריק"}
              </span>
            </label>

            <label className="upload-dropzone">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange(setSolvedExam)}
              />
              <span className="upload-title">מבחן פתור (PDF)</span>
              <span className="upload-hint">
                {solvedExam ? solvedExam.name : "לחצי להעלאת המבחן של התלמיד/ה"}
              </span>
            </label>

            <label className="rubric-field">
              <span className="rubric-label">מחוון בדיקה</span>
              <textarea
                className="rubric-textarea"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="הדביקי כאן את מחוון הבדיקה..."
                rows={6}
              />
            </label>

            <button type="submit" className="main-button" disabled={!canSubmit}>
              {loading ? "בודק..." : "בדיקת מבחן"}
            </button>

            {error && <div className="error-banner">{error}</div>}
          </form>

          <div className="panel score-panel">
            <div className="score-header">
              <div>
                <h2>ציון סופי</h2>
                <p className="panel-subtitle">
                  {result
                    ? `ציון מתוך ${result.max_score}`
                    : "העלי מבחן ולחצי על בדיקת מבחן כדי לראות את התוצאה"}
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
                  {showDeductions ? "הסתרת הורדות" : "הצגת הורדות"}
                </button>

                {showDeductions && (
                  <div className="deductions-card">
                    <div className="deductions-header">
                      <h3>הורדות ניקוד</h3>
                      <span className="deductions-total">
                        -{totalDeduction} נק׳
                      </span>
                    </div>

                    <div className="deductions-list">
                      {result.deductions.length === 0 ? (
                        <p>אין הורדות — ניקוד מלא.</p>
                      ) : (
                        result.deductions.map((d, i) => (
                          <div key={i} className="deduction-row">
                            <span>
                              <strong>שאלה {d.question_number}:</strong>{" "}
                              {d.reason}
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
            <h2>הערות למורה</h2>
            <p className="panel-subtitle">משוב כללי לתלמיד/ה</p>

            <div className="comments-list">
              {result ? (
                <div className="comment-card">{result.rationale}</div>
              ) : (
                <div className="comment-card placeholder">
                  נימוק הבדיקה יופיע כאן לאחר בדיקת המבחן.
                </div>
              )}
            </div>
          </div>

          <div className="panel comments-panel">
            <h2>היסטוריית בדיקות</h2>
            <p className="panel-subtitle">המבחנים האחרונים שנבדקו במערכת</p>

            <div className="comments-list">
              {history.length === 0 ? (
                <div className="comment-card placeholder">
                  עדיין אין בדיקות שמורות.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="comment-card">
                    <strong>{item.exam_name}</strong>
                    <br />
                    ציון: {item.final_score}/{item.max_score}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="right-column">
          <div className="panel viewer-panel">
            <div className="viewer-header">
              <div>
                <h2>תצוגה מקדימה של המבחן</h2>
                <p className="panel-subtitle">
                  תצוגה מקדימה של המבחן הפתור של התלמיד/ה
                </p>
              </div>
            </div>

            {!solvedExam ? (
              <div className="empty-viewer">
                <img src={logo} alt="AutoGrade" className="empty-logo" />
                <h3>עדיין לא הועלה מבחן פתור</h3>
                <p>העלי את המבחן הפתור כדי לראות אותו כאן.</p>
              </div>
            ) : (
              <div className="pdf-frame-wrapper">
                <iframe
                  title="תצוגה מקדימה של מבחן פתור"
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
                  <h2>מה ה־OCR זיהה</h2>
                  <p className="panel-subtitle">
                    השווי מול ה־PDF למעלה כדי לוודא שהבדיקה מבוססת על הטקסט הנכון.
                  </p>
                </div>

                <button
                  type="button"
                  className="main-button"
                  onClick={() => setShowOcr((prev) => !prev)}
                >
                  {showOcr ? "הסתרה" : "הצגה"}
                </button>
              </div>

              {showOcr && (
                <div className="ocr-list">
                  <div className="ocr-item">
                    <h4>מבחן ריק (שאלות)</h4>
                    <pre className="ocr-text">
                      {result.ocr_transcripts.questions_markdown || "(ריק)"}
                    </pre>
                  </div>

                  <div className="ocr-item">
                    <h4>מבחן פתור (תשובות)</h4>
                    <pre className="ocr-text">
                      {result.ocr_transcripts.answers_markdown || "(ריק)"}
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