import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./AuthPage.css";

function AuthPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(location.pathname === "/register" ? "signup" : "signin");
  const [signupStage, setSignupStage] = useState(1);
  const [signin, setSignin] = useState({ username: "", password: "" });
  const [signup, setSignup] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    address3: "",
    postalCode: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // "idle" | "checking" | "available" | "taken"
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const usernameDebounceRef = useRef(null);

  useEffect(() => {
    setMode(location.pathname === "/register" ? "signup" : "signin");
    setSignupStage(1);
  }, [location.pathname]);

  // Debounced username availability check
  useEffect(() => {
    const username = signup.username.trim();
    if (!username || !/^[\w.@+-]+$/.test(username)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/check-username/?username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(usernameDebounceRef.current);
  }, [signup.username]);

  const content = useMemo(
    () => ({
      signin: {
        title: "Welcome Back",
        heading: "Log in to your account",
        body: "Enter your username and password to continue shopping.",
        button: "Continue",
      },
      signup: {
        title: "Create Account",
        heading: "Start selling and buying",
        body: "Join us and manage your orders, wishlist, and profile.",
        button: "Create Account",
      },
    }),
    []
  );

  const switchMode = (nextMode) => {
    setError("");
    setMessage("");
    setMode(nextMode);
    setSignupStage(1);
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

  const handleNextStage = (event) => {
    event.preventDefault();
    setError("");

    if (!signup.username.trim()) {
      setError("Please enter a username.");
      return;
    }
    if (!/^[\w.@+-]+$/.test(signup.username)) {
      setError("Username can only contain letters, digits, and @/./+/-/_ (no spaces).");
      return;
    }
    if (usernameStatus === "checking") {
      setError("Please wait while we check username availability.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken. Please choose a different one.");
      return;
    }
    if (!signup.email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!signup.phone.trim()) {
      setError("Please enter your mobile number.");
      return;
    }
    if (!signup.password) {
      setError("Please enter a password.");
      return;
    }
    if (signup.password !== signup.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSignupStage(2);
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (signupStage === 1) {
      handleNextStage(event);
      return;
    }

    if (!signup.address1.trim()) {
      setError("Address Line 1 is required.");
      return;
    }
    if (!signup.postalCode.trim()) {
      setError("Postal / Zip Code is required.");
      return;
    }

    const addressJson = JSON.stringify({
      address1: signup.address1,
      address2: signup.address2,
      address3: signup.address3,
      postal_code: signup.postalCode,
    });

    const response = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: signup.username,
        password: signup.password,
        email: signup.email,
        phone: signup.phone,
        address: addressJson,
      }),
    });

    if (response.ok) {
      setMessage("Account created successfully! Please sign in.");
      setMode("signin");
      setSignupStage(1);
      navigate("/", { replace: true });
      setSignin({ username: signup.username, password: "" });
      setSignup({
        username: "",
        password: "",
        confirmPassword: "",
        email: "",
        phone: "",
        address1: "",
        address2: "",
        address3: "",
        postalCode: "",
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
              alt="CArTGo logo"
              className="auth-brand-logo"
            />
            <div>
              <p className="auth-brand-title">CArTGo</p>
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

        <div className="auth-card auth-card--centered">
          <form className="auth-form" onSubmit={mode === "signin" ? handleLogin : handleSignup}>
            {error && <div className="auth-alert">{error}</div>}
            {message && <div className="auth-alert auth-alert-success">{message}</div>}

            {mode === "signup" ? (
              <>
                {/* Step Progress Bar */}
                <div className="signup-steps">
                  <div
                    className={`signup-step ${signupStage === 1 ? "is-active" : ""} ${signupStage > 1 ? "is-complete" : ""}`}
                    onClick={() => signupStage > 1 && setSignupStage(1)}
                    style={{ cursor: signupStage > 1 ? "pointer" : "default" }}
                  >
                    <span className="step-num">1</span>
                    <span className="step-label">Personal Info</span>
                  </div>
                  <div className="step-line-container">
                    <div className={`step-line ${signupStage > 1 ? "is-complete" : ""}`} />
                  </div>
                  <div className={`signup-step ${signupStage === 2 ? "is-active" : ""}`}>
                    <span className="step-num">2</span>
                    <span className="step-label">Address Details</span>
                  </div>
                </div>

                {signupStage === 1 ? (
                  <div className="form-stage-content fade-in">
                    <label className="field-label">Username</label>
                    <input
                      className={`field-input field-input--small${usernameStatus === "taken"
                          ? " field-input--error"
                          : usernameStatus === "available"
                            ? " field-input--success"
                            : ""
                        }`}
                      type="text"
                      placeholder="e.g. alex_johnson"
                      value={signup.username}
                      onChange={(e) =>
                        setSignup((current) => ({
                          ...current,
                          username: e.target.value.trim(),
                        }))
                      }
                      required
                    />
                    {usernameStatus === "checking" && (
                      <p className="username-status username-status--checking">
                        ⏳ Checking availability…
                      </p>
                    )}
                    {usernameStatus === "available" && (
                      <p className="username-status username-status--available">
                        ✓ Username is available
                      </p>
                    )}
                    {usernameStatus === "taken" && (
                      <p className="username-status username-status--taken">
                        ✗ Username already taken
                      </p>
                    )}

                    <label className="field-label">Email</label>
                    <input
                      className="field-input field-input--small"
                      type="email"
                      placeholder="e.g. alex@gmail.com"
                      value={signup.email}
                      onChange={(e) => setSignup((current) => ({ ...current, email: e.target.value }))}
                      required
                    />

                    <label className="field-label">Mobile Number</label>
                    <input
                      className="field-input field-input--small"
                      type="text"
                      placeholder="e.g. 03001234567"
                      value={signup.phone}
                      onChange={(e) => setSignup((current) => ({ ...current, phone: e.target.value }))}
                      required
                    />

                    <label className="field-label">Password</label>
                    <input
                      className="field-input field-input--small"
                      type="password"
                      placeholder="Create password"
                      value={signup.password}
                      onChange={(e) => setSignup((current) => ({ ...current, password: e.target.value }))}
                      required
                    />

                    <label className="field-label">Confirm Password</label>
                    <input
                      className="field-input field-input--small"
                      type="password"
                      placeholder="Confirm password"
                      value={signup.confirmPassword}
                      onChange={(e) => setSignup((current) => ({ ...current, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                ) : (
                  <div className="form-stage-content fade-in">
                    <label className="field-label">Address Line 1</label>
                    <input
                      className="field-input field-input--small"
                      type="text"
                      placeholder="House/Apartment No, building name"
                      value={signup.address1}
                      onChange={(e) => setSignup((current) => ({ ...current, address1: e.target.value }))}
                      required
                    />

                    <label className="field-label">Address Line 2 (Optional)</label>
                    <input
                      className="field-input field-input--small"
                      type="text"
                      placeholder="Street, area, colony name"
                      value={signup.address2}
                      onChange={(e) => setSignup((current) => ({ ...current, address2: e.target.value }))}
                    />

                    <label className="field-label">Address Line 3 (Optional)</label>
                    <input
                      className="field-input field-input--small"
                      type="text"
                      placeholder="Landmark, city, state"
                      value={signup.address3}
                      onChange={(e) => setSignup((current) => ({ ...current, address3: e.target.value }))}
                    />

                    <label className="field-label">Postal / Zip Code</label>
                    <input
                      className="field-input field-input--small"
                      type="text"
                      placeholder="e.g. 44000"
                      value={signup.postalCode}
                      onChange={(e) => setSignup((current) => ({ ...current, postalCode: e.target.value }))}
                      required
                    />

                  </div>
                )}
              </>
            ) : (
              <>
                <label className="field-label">Username</label>
                <input
                  className="field-input field-input--small"
                  type="text"
                  placeholder="Enter your username"
                  value={signin.username}
                  onChange={(e) => setSignin((current) => ({ ...current, username: e.target.value }))}
                  required
                />

                <label className="field-label">Password</label>
                <input
                  className="field-input field-input--small"
                  type="password"
                  placeholder="Enter your password"
                  value={signin.password}
                  onChange={(e) => setSignin((current) => ({ ...current, password: e.target.value }))}
                  required
                />
              </>
            )}

            <div className="auth-actions-row" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              {mode === "signup" && signupStage === 2 && (
                <button
                  className="btn btn-secondary auth-btn-small"
                  type="button"
                  onClick={() => setSignupStage(1)}
                  style={{ flex: "1", padding: "10px", minHeight: "40px", fontSize: "0.9rem" }}
                >
                  Back
                </button>
              )}
              <button
                className="btn btn-primary auth-btn-small"
                type="submit"
                style={{ flex: "2", padding: "10px", minHeight: "40px", fontSize: "0.9rem" }}
              >
                {mode === "signin" ? "Continue" : signupStage === 1 ? "Next: Address Details" : "Create Account"}
              </button>
            </div>

            <p className="auth-switch" style={{ marginTop: "16px", justifyContent: "center" }}>
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
