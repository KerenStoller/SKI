import { useState } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  // Initialize state with values from localStorage if they exist
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("username"));

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername(null);
  };

  if (!token) {
    return (
      <Login 
        onLoginSuccess={(newToken: string, newUsername: string) => {
          // Save to local storage so the session persists on refresh
          localStorage.setItem("access_token", newToken);
          localStorage.setItem("username", newUsername);
          
          // Update the React state
          setToken(newToken);
          setUsername(newUsername);
        }} 
      />
    );
  }

  return (
    <Dashboard 
      token={token} 
      username={username ?? ""} 
      onLogout={handleLogout} 
    />
  );
}

export default App;