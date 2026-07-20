/// <reference types="vite/client" />

import { useCallback, useEffect, useState } from "react";
import logo from "../assets/logo.png";
import ProjectView from "./ProjectView";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

type Space = {
  id: number;
  name: string;
  teacher_username: string;
};

type Project = {
  id: number;
  name: string;
  rubric: string;
  empty_exam_path: string | null;
  run_count: number;
  created_at: string | null;
};

type View = { type: "projects" } | { type: "project"; id: number; name: string };

interface TeacherDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

export default function TeacherDashboard({ token, username, onLogout }: TeacherDashboardProps) {
  const [space, setSpace] = useState<Space | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>({ type: "projects" });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectRubric, setProjectRubric] = useState("");
  const [emptyExamFile, setEmptyExamFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [loadingProjects, setLoadingProjects] = useState(true);

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRubric, setEditRubric] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const fetchSpace = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/spaces/me`);
      if (!res.ok) throw new Error("Failed to fetch space");
      const data = await res.json();
      setSpace(data);
      return data as Space;
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [authFetch]);

  const fetchProjects = useCallback(
    async (spaceId: number) => {
      setLoadingProjects(true);
      try {
        const res = await authFetch(`${BACKEND_URL}/api/spaces/${spaceId}/projects`);
        if (!res.ok) throw new Error("Failed to fetch projects");
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProjects(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    document.title = "AutoGrade";
    fetchSpace().then((s) => {
      if (s) fetchProjects(s.id);
    });
  }, [fetchSpace, fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space || !emptyExamFile) return;
    setCreateError(null);
    setCreating(true);

    const formData = new FormData();
    formData.append("name", projectName.trim());
    formData.append("rubric", projectRubric);
    formData.append("empty_exam", emptyExamFile);

    try {
      const res = await authFetch(`${BACKEND_URL}/api/spaces/${space.id}/projects`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "יצירת הפרויקט נכשלה");
      }
      const newProject: Project = await res.json();
      setProjects((prev) => [newProject, ...prev]);
      setProjectName("");
      setProjectRubric("");
      setEmptyExamFile(null);
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    projectName.trim().length > 0 &&
    projectRubric.trim().length > 0 &&
    !!emptyExamFile &&
    !creating;

  const startEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(p.id);
    setEditName(p.name);
    setEditRubric(p.rubric);
    setSaveError(null);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(null);
    setSaveError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent, projectId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setSaveError(null);
    const formData = new FormData();
    formData.append("name", editName.trim());
    formData.append("rubric", editRubric);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "שמירה נכשלה");
      }
      const updated: Project = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name: updated.name, rubric: updated.rubric } : p)));
      setEditingProjectId(null);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const topbar = (
    <header className="topbar">
      <div className="brand">
        <img src={logo} alt="לוגו AutoGrade" className="brand-logo" />
        <div className="brand-text">
          <h1>AutoGrade</h1>
          <p>בדיקה חכמה, הוראה שמחה</p>
        </div>
      </div>
      <div className="account-card">
        <div className="account-header">
          <span className="account-avatar" aria-hidden="true">
            {username.charAt(0).toUpperCase()}
          </span>
          <span className="account-copy">
            <span>שלום,</span>
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
  );

  // ── Project detail view ──────────────────────────────────────────────────────
  if (view.type === "project") {
    return (
      <div className="page" dir="rtl">
        <div className="background-shape background-shape-one"></div>
        <div className="background-shape background-shape-two"></div>
        {topbar}
        <ProjectView
          token={token}
          projectId={view.id}
          projectName={view.name}
          onBack={() => {
            if (space) fetchProjects(space.id);
            setView({ type: "projects" });
          }}
          onLogout={onLogout}
        />
      </div>
    );
  }

  // ── Projects list view ───────────────────────────────────────────────────────
  return (
    <div className="page" dir="rtl">
      <div className="background-shape background-shape-one"></div>
      <div className="background-shape background-shape-two"></div>
      {topbar}

      <main className="dashboard">
        <section className="left-column">
          {/* Create project toggle */}
          <div className="panel upload-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2>פרויקט חדש</h2>
                <p className="panel-subtitle">העלה מבחן ריק ומחוון כדי ליצור פרויקט.</p>
              </div>
              <button
                type="button"
                className="main-button"
                onClick={() => {
                  setShowCreateForm((v) => !v);
                  setCreateError(null);
                }}
                style={{ width: "auto", padding: "8px 16px" }}
              >
                {showCreateForm ? "ביטול" : "+ פרויקט חדש"}
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateProject} style={{ marginTop: "20px" }}>
                <label className="rubric-field">
                  <span className="rubric-label">שם הפרויקט / המבחן</span>
                  <input
                    className="rubric-textarea"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="לדוגמה: מבחן מתמטיקה — יחידה 3"
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
                      if (f && f.type !== "application/pdf") {
                        alert("נא להעלות קובץ PDF בלבד.");
                        return;
                      }
                      setEmptyExamFile(f ?? null);
                    }}
                  />
                  <span className="upload-title">מבחן ריק (PDF)</span>
                  <span className="upload-hint">
                    {emptyExamFile ? emptyExamFile.name : "לחץ/י להעלאת המבחן הריק"}
                  </span>
                </label>

                <label className="rubric-field" style={{ marginTop: "12px" }}>
                  <span className="rubric-label">מחוון בדיקה</span>
                  <textarea
                    className="rubric-textarea"
                    value={projectRubric}
                    onChange={(e) => setProjectRubric(e.target.value)}
                    placeholder="הדבק/י כאן את מחוון הבדיקה..."
                    rows={6}
                    required
                  />
                </label>

                {createError && <div className="error-banner">{createError}</div>}

                <button
                  type="submit"
                  className="main-button"
                  disabled={!canCreate}
                  style={{ marginTop: "12px" }}
                >
                  {creating ? "מעבד OCR ויוצר פרויקט..." : "צור פרויקט"}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="right-column">
          <div className="panel viewer-panel">
            <div className="viewer-header">
              <div>
                <h2>{space?.name ?? "הפרויקטים שלי"}</h2>
                <p className="panel-subtitle">
                  {loadingProjects
                    ? "טוען פרויקטים..."
                    : projects.length === 0
                    ? "אין פרויקטים עדיין — צור/י פרויקט ראשון."
                    : `${projects.length} פרויקטים`}
                </p>
              </div>
            </div>

            <div className="comments-list" style={{ marginTop: "16px" }}>
              {loadingProjects ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                  <div className="projects-spinner" />
                </div>
              ) : projects.length === 0 ? (
                <div className="comment-card placeholder">
                  עדיין אין פרויקטים. לחץ/י על "פרויקט חדש" כדי להתחיל.
                </div>
              ) : (
                projects.map((p) => (
                  <div
                    key={p.id}
                    className="comment-card folder-card"
                    onClick={() => editingProjectId !== p.id && setView({ type: "project", id: p.id, name: p.name })}
                    style={{ cursor: editingProjectId === p.id ? "default" : "pointer" }}
                  >
                    {editingProjectId === p.id ? (
                      <form onSubmit={(e) => handleSaveEdit(e, p.id)} onClick={(e) => e.stopPropagation()}>
                        <label className="rubric-field" style={{ marginBottom: "10px" }}>
                          <span className="rubric-label">שם הפרויקט</span>
                          <input
                            className="rubric-textarea"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ height: "40px" }}
                            required
                            autoFocus
                          />
                        </label>
                        <label className="rubric-field" style={{ marginBottom: "10px" }}>
                          <span className="rubric-label">מחוון בדיקה</span>
                          <textarea
                            className="rubric-textarea"
                            value={editRubric}
                            onChange={(e) => setEditRubric(e.target.value)}
                            rows={5}
                            required
                          />
                        </label>
                        {saveError && <div className="error-banner" style={{ marginBottom: "8px" }}>{saveError}</div>}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button type="submit" className="main-button" disabled={saving || !editName.trim() || !editRubric.trim()} style={{ flex: 1 }}>
                            {saving ? "שומר..." : "שמור"}
                          </button>
                          <button type="button" className="main-button" onClick={cancelEdit} style={{ flex: 1, backgroundColor: "#64748b" }}>
                            ביטול
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "1.05rem" }}>{p.name}</strong>
                          {p.created_at && (
                            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                              {new Date(p.created_at).toLocaleDateString("he-IL")}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={(e) => startEdit(p, e)}
                            title="עריכת פרויקט"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "1.1rem", padding: "4px" }}
                          >
                            ✏️
                          </button>
                          <div style={{ textAlign: "center", minWidth: "64px" }}>
                            <div style={{ fontWeight: "bold", fontSize: "1.6rem", color: "#3b82f6" }}>
                              {p.run_count}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>בדיקות</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
