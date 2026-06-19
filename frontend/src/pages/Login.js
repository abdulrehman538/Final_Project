import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.detail || "Unable to sign in. Please check your credentials.");
        return;
      }

      const roleResponse = await fetch(`${API_BASE_URL}/api/user-role/`, {
        headers: {
          Authorization: `Bearer ${data.access}`,
        },
      });

      const roleData = await roleResponse.json().catch(() => ({}));
      const role = (roleData.role || "user").toString().toLowerCase();

      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("userRole", role);
      localStorage.setItem("username", username);

      onLogin(data.access, role, username);
      const dest = role === "admin" ? "/dashboard" : "/marketplace";
      navigate(dest);
    } catch (error) {
      console.error("Login failed", error);
      setError("Unable to reach the server. Please make sure the backend is running.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your dashboard</h1>
          <p className="subtext">Manage products, users, and orders with a polished ecommerce admin experience.</p>
        </div>

        {error && <div className="auth-alert">{error}</div>}

        <label className="field-label">Username</label>
        <input
          className="field-input"
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="field-label">Password</label>
        <input
          className="field-input"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn btn-primary auth-button" onClick={handleLogin}>
          Continue
        </button>

        <div className="auth-footer">
          <span>New to the platform?</span>
          <button className="btn btn-secondary" onClick={() => navigate("/register")}>Create account</button>
        </div>
      </div>
    </div>
  );
}

export default Login;
