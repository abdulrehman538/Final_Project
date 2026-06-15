import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./AuthPage.css";

function AuthPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(location.pathname === "/register" ? "signup" : "signin");
  const [signin, setSignin] = useState({ username: "", password: "" });
  const [signup, setSignup] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMode(location.pathname === "/register" ? "signup" : "signin");
  }, [location.pathname]);

  const content = useMemo(
    () => ({
      signin: {
        title: "",
        heading: "",
        body: "",
        button: "Continue",
      },
      signup: {
        title: "",
        heading: "",
        body: "",
        button: "Create Account",
      },
    }),
    []
  );

  const switchMode = (nextMode) => {
    setError("");
    setMessage("");
    setMode(nextMode);
    navigate(nextMode === "signin" ? "/" : "/register", { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    const response = await fetch("http://127.0.0.1:8000/api/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: signin.username,
        password: signin.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.detail || "Unable to sign in. Please check your credentials.");
      return;
    }

    const roleResponse = await fetch("http://127.0.0.1:8000/api/user-role/", {
      headers: { Authorization: `Bearer ${data.access}` },
    });

    const roleData = await roleResponse.json();
    const role = (roleData.role || "user").toString().toLowerCase();

    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("userRole", role);
    localStorage.setItem("username", signin.username);

    onLogin(data.access, role, signin.username);
    navigate(role === "admin" ? "/dashboard" : role === "seller" ? "/products" : "/marketplace");
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (signup.password !== signup.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const response = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: signup.username,
        password: signup.password,
        email: signup.email,
        phone: signup.phone,
      }),
    });

    if (response.ok) {
      setMessage("Account created successfully. Please sign in.");
      setMode("signin");
      navigate("/", { replace: true });
      setSignin({ username: signup.username, password: "" });
      setSignup({
        username: "",
        password: "",
        confirmPassword: "",
        email: "",
        phone: "",
      });
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || "Registration failed. Please try again.");
    }
  };

  const activeContent = content[mode];

  return (
    <div className="auth-shell">
      <section className="auth-promo">
        <div className="auth-overlay" />
        <div className="auth-promo-content">
          <div className="auth-brand">
            <img
              src="/Final%20App%20Logo.png"
              alt="Daraz Market logo"
              className="auth-brand-logo"
            />
            <div>
              <p className="auth-brand-title">Daraz Market</p>
              <span className="auth-brand-subtitle">Buy. Sell. Grow.</span>
            </div>
          </div>

          <h1>Everything you need to shop and sell online.</h1>
          <p>
            Browse curated products, save favorites, manage your profile, and check out through a clean
            marketplace experience designed for buyers and sellers.
          </p>

          <div className="auth-stats">
            <div>
              <strong>10K+</strong>
              <span>Products</span>
            </div>
            <div>
              <strong>500+</strong>
              <span>Stores</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Support</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === "signin" ? " is-active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab${mode === "signup" ? " is-active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-card auth-card--split">
          <div className="auth-copy">
            <p className="eyebrow">{activeContent.title}</p>
            <h2>{activeContent.heading}</h2>
            <p className="subtext">{activeContent.body}</p>
          </div>

          <form className="auth-form" onSubmit={mode === "signin" ? handleLogin : handleSignup}>
            {error && <div className="auth-alert">{error}</div>}
            {message && <div className="auth-alert auth-alert-success">{message}</div>}

            {mode === "signup" ? (
              <>
                <label className="field-label">Enter Your Name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Enter your name"
                  value={signup.username}
                  onChange={(e) => setSignup((current) => ({ ...current, username: e.target.value }))}
                />

                <label className="field-label">Enter Your Email</label>
                <input
                  className="field-input"
                  type="email"
                  placeholder="Enter your email"
                  value={signup.email}
                  onChange={(e) => setSignup((current) => ({ ...current, email: e.target.value }))}
                />

                <label className="field-label">Enter Your Mobile No.</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Enter your mobile number"
                  value={signup.phone}
                  onChange={(e) => setSignup((current) => ({ ...current, phone: e.target.value }))}
                />

                <label className="field-label">Password</label>
                <input
                  className="field-input"
                  type="password"
                  placeholder="Create password"
                  value={signup.password}
                  onChange={(e) => setSignup((current) => ({ ...current, password: e.target.value }))}
                />

                <label className="field-label">Confirm Password</label>
                <input
                  className="field-input"
                  type="password"
                  placeholder="Confirm password"
                  value={signup.confirmPassword}
                  onChange={(e) => setSignup((current) => ({ ...current, confirmPassword: e.target.value }))}
                />
              </>
            ) : (
              <>
                <label className="field-label">Username</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Enter your username"
                  value={signin.username}
                  onChange={(e) => setSignin((current) => ({ ...current, username: e.target.value }))}
                />

                <label className="field-label">Password</label>
                <input
                  className="field-input"
                  type="password"
                  placeholder="Enter your password"
                  value={signin.password}
                  onChange={(e) => setSignin((current) => ({ ...current, password: e.target.value }))}
                />
              </>
            )}

            <button className="btn btn-primary auth-submit" type="submit">
              {activeContent.button}
            </button>

            <p className="auth-switch">
              {mode === "signin" ? "Need an account?" : "Already have an account?"}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

export default AuthPage;
