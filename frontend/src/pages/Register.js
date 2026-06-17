import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError("");
    setMessage("");

    const response = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      setMessage("Account created successfully. Redirecting to sign in...");
      setUsername("");
      setPassword("");
      setTimeout(() => navigate("/"), 1200);
    } else {
      const data = await response.json();
      setError(data.detail || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <p className="eyebrow">Create account</p>
          <h1>Start selling with confidence</h1>
          <p className="subtext">Join the admin dashboard and manage products, orders, and analytics.</p>
        </div>

        {error && <div className="auth-alert auth-alert-error">{error}</div>}
        {message && <div className="auth-alert auth-alert-success">{message}</div>}

        <label className="field-label">Username</label>
        <div className="help-text">
             ℹ️ Username must be unique
        </div>
        <input
          className="field-input"
          type="text"
          placeholder="Create username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="field-label">Password</label>
        <input
          className="field-input"
          type="password"
          placeholder="Create password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn btn-primary auth-button" onClick={handleRegister}>
          Create account
        </button>

        <button className="btn btn-secondary auth-link" onClick={() => navigate("/")}>Back to login</button>
      </div>
    </div>
  );
}

export default Register;
