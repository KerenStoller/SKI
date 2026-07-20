/// <reference types="vite/client" />

import { useState } from "react";
import logo from "../assets/logo.png";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface LoginProps {
  onLoginSuccess: (token: string, username: string, role: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorType, setAuthErrorType] = useState<"not-found" | "general" | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthErrorType(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const isNotFound = res.status === 404;
        setAuthErrorType(isNotFound ? "not-found" : "general");
        throw new Error(body.detail || "פרטי התחברות שגויים");
      }

      const data = await res.json();
      onLoginSuccess(data.access_token, data.username, data.role);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="page login-page" dir="rtl">
      <div className="background-shape background-shape-one"></div>
      <div className="background-shape background-shape-two"></div>
      <div className="login-box">
        <img src={logo} alt="לוגו AutoGrade" className="brand-logo" />
        <h2>התחברות למערכת</h2>
        <p>הקלד/י שם משתמש וסיסמה כדי להתחבר</p>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="שם משתמש"
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="סיסמה"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            required
          />
          {authError && (
            <div className={`error-banner${authErrorType === "not-found" ? " error-banner--not-found" : ""}`}>
              {authErrorType === "not-found" && <span className="error-icon">👤</span>}
              {authError}
            </div>
          )}
          <button type="submit" className="main-button">
            כניסה למערכת
          </button>
        </form>
      </div>
    </div>
  );
}
