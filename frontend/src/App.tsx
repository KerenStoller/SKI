import { useEffect, useState } from "react";

function App() {
  const [health, setHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => setHealth(data.status))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "4rem" }}>
      <h1>SKI App</h1>
      <p>Welcome! The frontend is up and running.</p>
      <div style={{ marginTop: "2rem" }}>
        <strong>Backend health:</strong>{" "}
        {health ? (
          <span style={{ color: "green" }}>{health}</span>
        ) : error ? (
          <span style={{ color: "red" }}>Error: {error}</span>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </div>
  );
}

export default App;
