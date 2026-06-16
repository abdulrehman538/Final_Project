import { useState } from "react";
import "../pages/AuthPage.css";

function GuestAuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("prompt"); // "prompt", "signin", "signup"
  const [signin, setSignin] = useState({ username: "", password: "" });
  const [signup, setSignup] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signin),
      });

      const data = await response.json();

      if (response.ok) {
        const role = data.user_type || "buyer";
        onLoginSuccess(data.access, role, signin.username);
        onClose();
      } else {
        setError(data.detail || "Unable to sign in. Please check your credentials.");
      }
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (signup.password !== signup.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signup.username,
          email: signup.email,
          password: signup.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Account created successfully! Please sign in.");
        setMode("signin");
        setSignup({ username: "", email: "", password: "", confirmPassword: "" });
      } else {
        setError(
          data.detail ||
          Object.values(data).flat().join(" ") ||
          "Failed to create account."
        );
      }
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="auth-modal-card fade-in">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        {mode === "prompt" ? (
          <div className="auth-prompt">
            <h2>Welcome to CArTGo</h2>
            <p className="subtext">Sign in to your account or create a new one to continue shopping.</p>

            <div className="auth-prompt-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode("signup")}
              >
                Create Account
              </button>
            </div>

            <button
              type="button"
              className="btn btn-link"
              onClick={onClose}
            >
              Continue as Guest
            </button>
          </div>
        ) : mode === "signin" ? (
          <form onSubmit={handleSignIn} className="auth-form">
            <div className="modal-header">
              <h2>Sign In</h2>
              <button
                type="button"
                className="btn btn-link back-btn"
                onClick={() => setMode("prompt")}
              >
                ← Back
              </button>
            </div>

            {error && <div className="alert-box alert-danger">{error}</div>}
            {message && <div className="alert-box alert-success">{message}</div>}

            <div className="form-group">
              <label className="field-label">Username</label>
              <input
                className="field-input"
                type="text"
                placeholder="Enter your username"
                value={signin.username}
                onChange={(e) =>
                  setSignin({ ...signin, username: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="Enter your password"
                value={signin.password}
                onChange={(e) =>
                  setSignin({ ...signin, password: e.target.value })
                }
                required
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            <p className="auth-footer-text">
              Don't have an account?{" "}
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="auth-form">
            <div className="modal-header">
              <h2>Create Account</h2>
              <button
                type="button"
                className="btn btn-link back-btn"
                onClick={() => setMode("prompt")}
              >
                ← Back
              </button>
            </div>

            {error && <div className="alert-box alert-danger">{error}</div>}
            {message && <div className="alert-box alert-success">{message}</div>}

            <div className="form-group">
              <label className="field-label">Username</label>
              <input
                className="field-input"
                type="text"
                placeholder="Choose a username"
                value={signup.username}
                onChange={(e) =>
                  setSignup({ ...signup, username: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                placeholder="Enter your email"
                value={signup.email}
                onChange={(e) =>
                  setSignup({ ...signup, email: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="Create a password"
                value={signup.password}
                onChange={(e) =>
                  setSignup({ ...signup, password: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Confirm Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="Confirm your password"
                value={signup.confirmPassword}
                onChange={(e) =>
                  setSignup({ ...signup, confirmPassword: e.target.value })
                }
                required
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <p className="auth-footer-text">
              Already have an account?{" "}
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default GuestAuthModal;
