/// <reference types="vite/client" />

import { useState } from "react";
import logo from "../assets/logo.png";
// 
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      
      if (!res.ok) throw new Error("פרטי התחברות שגויים");
      
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("username", data.username);
      
      onLoginSuccess(data.access_token, data.username);
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
        <p>הקלידי שם משתמש וסיסמה כדי להתחבר או ליצור סביבה חדשה</p>
        <form onSubmit={handleLogin}>
          <input 
            type="text" 
            placeholder="שם משתמש" 
            value={loginUser} 
            onChange={e => setLoginUser(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="סיסמה" 
            value={loginPass} 
            onChange={e => setLoginPass(e.target.value)} 
            required 
          />
          {authError && <div className="error-banner">{authError}</div>}
          <button type="submit" className="main-button">כניסה למערכת</button>
        </form>
      </div>
    </div>
  );
}
