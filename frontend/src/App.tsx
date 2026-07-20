import { useState } from "react";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import "./App.css";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("username"));
  const [role, setRole] = useState<string | null>(localStorage.getItem("role"));

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setToken(null);
    setUsername(null);
    setRole(null);
  };

  if (!token) {
    return (
      <Login
        onLoginSuccess={(newToken, newUsername, newRole) => {
          localStorage.setItem("access_token", newToken);
          localStorage.setItem("username", newUsername);
          localStorage.setItem("role", newRole);
          setToken(newToken);
          setUsername(newUsername);
          setRole(newRole);
        }}
      />
    );
  }

  if (role === "admin") {
    return (
      <AdminDashboard
        token={token}
        username={username ?? ""}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <TeacherDashboard
      token={token}
      username={username ?? ""}
      onLogout={handleLogout}
    />
  );
}

export default App;
