/// <reference types="vite/client" />

import { useCallback, useEffect, useState } from "react";
import logo from "../assets/logo.png";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

type Project = {
  id: number;
  name: string;
  rubric: string;
  run_count: number;
  created_at: string | null;
};

type TeacherGroup = {
  teacher_username: string;
  space_id: number;
  space_name: string;
  projects: Project[];
  pending?: boolean;
};

interface AdminDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, username, onLogout }: AdminDashboardProps) {
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  type Confirm = { message: string; onConfirm: () => void };
  const [confirm, setConfirm] = useState<Confirm | null>(null);

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

  const fetchAllProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/admin/all-projects`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setTeacherGroups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const deleteTeacher = (teacherUsername: string) => {
    setConfirm({
      message: `למחוק את המורה "${teacherUsername}" וכל הפרויקטים שלו/ה?`,
      onConfirm: async () => {
        setConfirm(null);
        setTeacherGroups((prev) => prev.filter((g) => g.teacher_username !== teacherUsername));
        if (expandedTeacher === teacherUsername) setExpandedTeacher(null);
        await authFetch(`${BACKEND_URL}/api/admin/teachers/${teacherUsername}`, { method: "DELETE" });
      },
    });
  };

  const deleteProject = (teacherUsername: string, projectId: number, projectName: string) => {
    setConfirm({
      message: `למחוק את הפרויקט "${projectName}"?`,
      onConfirm: async () => {
        setConfirm(null);
        setTeacherGroups((prev) =>
          prev.map((g) =>
            g.teacher_username === teacherUsername
              ? { ...g, projects: g.projects.filter((p) => p.id !== projectId) }
              : g
          )
        );
        await authFetch(`${BACKEND_URL}/api/admin/projects/${projectId}`, { method: "DELETE" });
      },
    });
  };

  useEffect(() => {
    document.title = "AutoGrade — מנהל";
    fetchAllProjects();
  }, [fetchAllProjects]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const username = newUsername.trim();
    const password = newPassword;

    // Optimistically add to list immediately
    const optimisticEntry: TeacherGroup = {
      teacher_username: username,
      space_id: -1,
      space_name: `הסביבה של ${username}`,
      projects: [],
      pending: true,
    };
    setTeacherGroups((prev) => [optimisticEntry, ...prev]);
    setNewUsername("");
    setNewPassword("");

    authFetch(`${BACKEND_URL}/api/admin/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTeacherGroups((prev) => prev.filter((g) => g.teacher_username !== username));
        setCreateError(body.detail || "יצירת מורה נכשלה");
      } else {
        setTeacherGroups((prev) =>
          prev.map((g) => g.teacher_username === username ? { ...g, pending: false } : g)
        );
        setCreateSuccess(`מורה "${username}" נוצר בהצלחה.`);
      }
    }).catch(() => {
      setTeacherGroups((prev) => prev.filter((g) => g.teacher_username !== username));
      setCreateError("שגיאת רשת — יצירת המורה נכשלה");
    });
  };

  const totalProjects = teacherGroups.reduce((sum, g) => sum + g.projects.length, 0);

  return (
    <div className="page" dir="rtl">
      <div className="background-shape background-shape-one"></div>
      <div className="background-shape background-shape-two"></div>

      {/* Confirm dialog */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px", padding: "32px 28px",
            maxWidth: "380px", width: "90%", boxShadow: "0 24px 60px rgba(15,23,42,0.2)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🗑️</div>
            <p style={{ margin: "0 0 24px", fontSize: "1rem", color: "#1e293b", lineHeight: 1.5 }}>
              {confirm.message}
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="main-button"
                onClick={confirm.onConfirm}
                style={{ flex: 1, marginTop: 0, background: "linear-gradient(135deg,#dc2626,#ef4444)" }}
              >
                כן, מחק
              </button>
              <button
                className="main-button"
                onClick={() => setConfirm(null)}
                style={{ flex: 1, marginTop: 0, background: "#64748b" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="לוגו AutoGrade" className="brand-logo" />
          <div className="brand-text">
            <h1>AutoGrade</h1>
            <p>ממשק מנהל</p>
          </div>
        </div>

        <div className="account-card">
          <div className="account-header">
            <span className="account-avatar" aria-hidden="true">
              {username.charAt(0).toUpperCase()}
            </span>
            <span className="account-copy">
              <span>מנהל</span>
              <strong>{username}</strong>
            </span>
            <span className="session-pill">מחובר</span>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            התנתקות
          </button>
        </div>
      </header>

      <main style={{ padding: "24px 32px", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Create Teacher section at top */}
        <div className="panel upload-panel" style={{ marginBottom: "28px" }}>
          <h2>הוספת מורה חדש</h2>
          <p className="panel-subtitle">צור חשבון מורה — מרחב העבודה שלו/ה ייווצר אוטומטית.</p>

          <form onSubmit={handleCreateTeacher} style={{ marginTop: "16px", display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="rubric-field" style={{ flex: "1", minWidth: "180px" }}>
              <span className="rubric-label">שם משתמש</span>
              <input
                className="rubric-textarea"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="לדוגמה: teacher1"
                style={{ height: "40px" }}
                required
              />
            </label>

            <label className="rubric-field" style={{ flex: "1", minWidth: "180px" }}>
              <span className="rubric-label">סיסמה</span>
              <input
                type="password"
                className="rubric-textarea"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="סיסמה ראשונית"
                style={{ height: "40px" }}
                required
              />
            </label>

            <button type="submit" className="main-button" style={{ width: "auto", padding: "8px 24px" }}>
              צור מורה
            </button>
          </form>

          {createError && (
            <div className="error-banner" style={{ marginTop: "12px" }}>{createError}</div>
          )}
          {createSuccess && (
            <div className="error-banner" style={{ marginTop: "12px", backgroundColor: "#d1fae5", color: "#065f46", borderColor: "#a7f3d0" }}>
              {createSuccess}
            </div>
          )}
        </div>

        {/* All teachers' projects */}
        <div className="panel viewer-panel">
          <div className="viewer-header" style={{ marginBottom: "16px" }}>
            <div>
              <h2>כל הפרויקטים</h2>
              <p className="panel-subtitle">
                {loading
                  ? "טוען..."
                  : teacherGroups.length === 0
                  ? "אין מורים עדיין."
                  : `${teacherGroups.length} מורים · ${totalProjects} פרויקטים`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="comment-card placeholder">טוען פרויקטים...</div>
          ) : teacherGroups.length === 0 ? (
            <div className="comment-card placeholder">אין מורים עדיין. הוסף מורה ראשון למעלה.</div>
          ) : (
            teacherGroups.map((group) => {
              const isOpen = expandedTeacher === group.teacher_username;
              return (
                <div key={group.teacher_username} style={{ marginBottom: "10px" }}>
                  <div
                    onClick={() => !group.pending && setExpandedTeacher(isOpen ? null : group.teacher_username)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      background: group.pending ? "#f8fafc" : isOpen ? "#eff6ff" : "#f8fafc",
                      border: `1px solid ${group.pending ? "#e2e8f0" : isOpen ? "#bfdbfe" : "#e2e8f0"}`,
                      cursor: group.pending ? "default" : "pointer",
                      transition: "background 0.15s, border-color 0.15s",
                      userSelect: "none",
                      opacity: group.pending ? 0.75 : 1,
                    }}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: "#3b82f6", color: "#fff", fontWeight: "bold", fontSize: "0.95rem", flexShrink: 0,
                    }}>
                      {group.teacher_username.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: "1.05rem" }}>{group.teacher_username}</strong>
                      <span style={{ marginRight: "8px", color: "#64748b", fontSize: "0.85rem" }}>{group.space_name}</span>
                    </div>
                    <span style={{
                      background: "#eff6ff", color: "#3b82f6", borderRadius: "12px",
                      padding: "2px 10px", fontSize: "0.8rem", fontWeight: 600, flexShrink: 0,
                    }}>
                      {group.projects.length} פרויקטים
                    </span>
                    {!group.pending && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteTeacher(group.teacher_username); }}
                        title="מחק מורה"
                        style={{
                          background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
                          color: "#cbd5e1", fontSize: "1rem", borderRadius: "8px", flexShrink: 0,
                          transition: "color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                      >
                        🗑️
                      </button>
                    )}
                    {group.pending ? (
                      <span className="projects-spinner" style={{ width: "18px", height: "18px", flexShrink: 0 }} />
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "1rem", flexShrink: 0 }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: "6px", marginRight: "14px" }}>
                      {group.projects.length === 0 ? (
                        <div className="comment-card placeholder">אין פרויקטים עדיין.</div>
                      ) : (
                        <div className="comments-list">
                          {group.projects.map((p) => (
                            <div key={p.id} className="comment-card">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ fontSize: "1rem" }}>{p.name}</strong>
                                  {p.created_at && (
                                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                                      {new Date(p.created_at).toLocaleDateString("he-IL")}
                                    </div>
                                  )}
                                </div>
                                <div style={{ textAlign: "center", minWidth: "56px" }}>
                                  <div style={{ fontWeight: "bold", fontSize: "1.4rem", color: "#10b981" }}>
                                    {p.run_count}
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>בדיקות</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteProject(group.teacher_username, p.id, p.name)}
                                  title="מחק פרויקט"
                                  style={{
                                    background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
                                    color: "#cbd5e1", fontSize: "1rem", borderRadius: "8px", flexShrink: 0,
                                    transition: "color 0.15s, background 0.15s",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
