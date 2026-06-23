import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getPostLoginPath, normalizeRole } from "../utils/roles";
import { saveAuthTokens } from "../utils/authSession";
import { validateEmail, validatePhone } from "../utils/validation";
import "./AuthPage.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function AuthPage({ onLogin, portalOnly = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(location.pathname === "/register" || searchParams.get("mode") === "signup" ? "signup" : "signin");
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
    storeName: "",
    businessDescription: "",
    termsAccepted: false,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const usernameDebounceRef = useRef(null);

  useEffect(() => {
    const forceSignup = searchParams.get("mode") === "signup";
    setMode(location.pathname === "/register" || forceSignup ? "signup" : "signin");
    setSignupStage(1);
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (location.state?.sessionExpired) {
      setError("Your session has expired. Please sign in again.");
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location, navigate]);

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

  const switchMode = (nextMode) => {
    setError("");
    setMessage("");
    setMode(nextMode);
    setSignupStage(1);
    // Preserve any existing redirect query parameter
    const existingRedirect = searchParams.get("redirect");
    const basePath = "/portal";
    const url = existingRedirect ? `${basePath}?redirect=${encodeURIComponent(existingRedirect)}` : basePath;
    navigate(url, { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signin.username,
          password: signin.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.detail || "Unable to sign in. Please check your credentials.");
        return;
      }

      const roleResponse = await fetch(`${API_BASE_URL}/api/user-role/`, {
        headers: { Authorization: `Bearer ${data.access}` },
      });

      const roleData = await roleResponse.json().catch(() => ({}));
      const role = normalizeRole(roleData.role);
      const sellerStatus = roleData.seller_status || "none";

      saveAuthTokens({ access: data.access, refresh: data.refresh });
      localStorage.setItem("userRole", role);
      localStorage.setItem("sellerStatus", sellerStatus);
      localStorage.setItem("username", signin.username);

      onLogin(data.access, role, signin.username, sellerStatus);
      const redirectAfterLogin = searchParams.get("redirect");
      if (redirectAfterLogin) {
        navigate(redirectAfterLogin);
      } else {
        navigate(getPostLoginPath(role));
      }
    } catch (error) {
      console.error("Login failed", error);
      setError("Unable to reach the server. Please make sure the backend is running.");
    }
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
    const emailError = validateEmail(signup.email, { required: true });
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!signup.phone.trim()) {
      setError("Please enter your mobile number.");
      return;
    }
    const phoneError = validatePhone(signup.phone, { required: true });
    if (phoneError) {
      setError(phoneError);
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

    if (portalOnly) {
      if (!signup.storeName.trim()) {
        setError("Store name is required.");
        return;
      }
      if (!signup.businessDescription.trim()) {
        setError("Business description is required.");
        return;
      }
      if (!signup.termsAccepted) {
        setError("You must accept the seller terms.");
        return;
      }
    }

    const addressJson = JSON.stringify({
      address1: signup.address1,
      address2: signup.address2,
      address3: signup.address3,
      postal_code: signup.postalCode,
    });

    const registerPayload = {
      username: signup.username,
      password: signup.password,
      email: signup.email,
      phone: signup.phone,
      address: addressJson,
    };

    if (portalOnly) {
      registerPayload.apply_as_seller = true;
      registerPayload.store_name = signup.storeName.trim();
      registerPayload.business_description = signup.businessDescription.trim();
      registerPayload.contact_phone = signup.phone.trim();
      registerPayload.terms_accepted = signup.termsAccepted;
    }

    const response = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload),
    });

    if (response.ok) {
      setMessage(
        portalOnly
          ? "Application received. Review is typically completed within one business day. You may sign in now; seller features activate after approval."
          : "Account created successfully! Please sign in."
      );
      setMode("signin");
      setSignupStage(1);
      // After successful registration, redirect to original page if provided
    const redirectAfterSignup = searchParams.get("redirect");
    if (redirectAfterSignup) {
      navigate(redirectAfterSignup, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
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
        storeName: "",
        businessDescription: "",
        termsAccepted: false,
      });
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="portal-auth">
      <header className="portal-auth__header">
        <div className="portal-auth__brand">
          <img src="/Final%20App%20Logo.png" alt="CArTGo" className="portal-auth__logo" />
          <div>
            <strong>CArTGo</strong>
            <span>Seller & operations portal</span>
          </div>
        </div>
        <button type="button" className="portal-auth__market-link" onClick={() => navigate("/marketplace")}>
          Return to marketplace
        </button>
      </header>

      <main className="portal-auth__main">
        <div
          className={`portal-auth__panel${
            mode === "signup" ? " portal-auth__panel--application" : " portal-auth__panel--signin"
          }`}
        >
          <div className="portal-auth__tabs">
            <button
              type="button"
              className={`portal-auth__tab${mode === "signin" ? " is-active" : ""}`}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`portal-auth__tab${mode === "signup" ? " is-active" : ""}`}
              onClick={() => switchMode("signup")}
            >
              Seller application
            </button>
          </div>

          {mode === "signup" && (
            <header className="portal-application__intro">
              <h1>Register as a seller</h1>
              <p>
                Complete the form below to apply for a seller account. Applications are reviewed before
                store access is granted.
              </p>
            </header>
          )}

          <form
            className={`portal-auth__form${mode === "signup" ? " portal-auth__form--application" : ""}`}
            onSubmit={mode === "signin" ? handleLogin : handleSignup}
          >
            {error && <div className="auth-alert">{error}</div>}
            {message && <div className="auth-alert auth-alert-success">{message}</div>}

            {mode === "signup" ? (
              <>
                <div className="signup-steps signup-steps--portal">
                  <div
                    className={`signup-step ${signupStage === 1 ? "is-active" : ""} ${signupStage > 1 ? "is-complete" : ""}`}
                    onClick={() => signupStage > 1 && setSignupStage(1)}
                    style={{ cursor: signupStage > 1 ? "pointer" : "default" }}
                  >
                    <span className="step-num">1</span>
                    <span className="step-label">Account credentials</span>
                  </div>
                  <div className="step-line-container">
                    <div className={`step-line ${signupStage > 1 ? "is-complete" : ""}`} />
                  </div>
                  <div className={`signup-step ${signupStage === 2 ? "is-active" : ""}`}>
                    <span className="step-num">2</span>
                    <span className="step-label">Business profile</span>
                  </div>
                </div>

                {signupStage === 1 ? (
                  <div className="portal-form-grid fade-in">
                    <div className="portal-field">
                      <label className="field-label">Username</label>
                      <input
                        className={`field-input portal-input${usernameStatus === "taken"
                            ? " field-input--error"
                            : usernameStatus === "available"
                              ? " field-input--success"
                              : ""
                          }`}
                        type="text"
                        placeholder="Letters, numbers, @ . + - _"
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
                        <p className="username-status username-status--checking">Checking availability…</p>
                      )}
                      {usernameStatus === "available" && (
                        <p className="username-status username-status--available">Username is available</p>
                      )}
                      {usernameStatus === "taken" && (
                        <p className="username-status username-status--taken">Username is already taken</p>
                      )}
                    </div>

                    <div className="portal-field">
                      <label className="field-label">Email address</label>
                      <input
                        className="field-input portal-input"
                        type="email"
                        placeholder="business@company.com"
                        value={signup.email}
                        onChange={(e) => setSignup((current) => ({ ...current, email: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="portal-field">
                      <label className="field-label">Mobile number</label>
                      <input
                        className="field-input portal-input"
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="03001234567"
                        value={signup.phone}
                        onChange={(e) => setSignup((current) => ({ ...current, phone: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="portal-field">
                      <label className="field-label">Password</label>
                      <input
                        className="field-input portal-input"
                        type="password"
                        placeholder="Minimum 8 characters recommended"
                        value={signup.password}
                        onChange={(e) => setSignup((current) => ({ ...current, password: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="portal-field portal-field--full">
                      <label className="field-label">Confirm password</label>
                      <input
                        className="field-input portal-input"
                        type="password"
                        placeholder="Re-enter password"
                        value={signup.confirmPassword}
                        onChange={(e) => setSignup((current) => ({ ...current, confirmPassword: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                ) : portalOnly ? (
                  <div className="portal-application__body fade-in">
                    <div className="portal-application__columns">
                      <section className="portal-application__block">
                        <h2 className="portal-application__block-title">Store profile</h2>
                        <p className="portal-application__block-desc">
                          Public-facing information displayed to customers on the marketplace.
                        </p>
                        <div className="portal-field">
                          <label className="field-label" htmlFor="seller-store-name">Store name</label>
                          <input
                            id="seller-store-name"
                            className="field-input portal-input"
                            type="text"
                            placeholder="Registered business or brand name"
                            value={signup.storeName}
                            onChange={(e) =>
                              setSignup((current) => ({ ...current, storeName: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="portal-field">
                          <label className="field-label" htmlFor="seller-business-description">
                            Business description
                          </label>
                          <textarea
                            id="seller-business-description"
                            className="field-input portal-input portal-textarea"
                            placeholder="Product categories, service standards, and what customers should expect."
                            rows={5}
                            value={signup.businessDescription}
                            onChange={(e) =>
                              setSignup((current) => ({
                                ...current,
                                businessDescription: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      </section>

                      <section className="portal-application__block">
                        <h2 className="portal-application__block-title">Business address</h2>
                        <p className="portal-application__block-desc">
                          Used for verification and operational correspondence.
                        </p>
                        <div className="portal-field">
                          <label className="field-label">Address line 1</label>
                          <input
                            className="field-input portal-input"
                            type="text"
                            placeholder="Building, unit, or street number"
                            value={signup.address1}
                            onChange={(e) =>
                              setSignup((current) => ({ ...current, address1: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="portal-field">
                          <label className="field-label">Address line 2</label>
                          <input
                            className="field-input portal-input"
                            type="text"
                            placeholder="Street, sector, or area"
                            value={signup.address2}
                            onChange={(e) =>
                              setSignup((current) => ({ ...current, address2: e.target.value }))
                            }
                          />
                        </div>
                        <div className="portal-field">
                          <label className="field-label">City / region</label>
                          <input
                            className="field-input portal-input"
                            type="text"
                            placeholder="City, state, or landmark"
                            value={signup.address3}
                            onChange={(e) =>
                              setSignup((current) => ({ ...current, address3: e.target.value }))
                            }
                          />
                        </div>
                        <div className="portal-field">
                          <label className="field-label">Postal code</label>
                          <input
                            className="field-input portal-input"
                            type="text"
                            placeholder="44000"
                            value={signup.postalCode}
                            onChange={(e) =>
                              setSignup((current) => ({ ...current, postalCode: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </section>
                    </div>

                    <section className="portal-application__agreement">
                      <h2 className="portal-application__block-title">Seller agreement</h2>
                      <div className="portal-agreement__document">
                        <p>
                          This application registers your business as a seller on the CArTGo marketplace.
                          All information submitted must be accurate and kept current.
                        </p>
                        <p>
                          <strong>Approval.</strong> Seller privileges are not activated at registration.
                          Each application is reviewed by our operations team. Most reviews are completed
                          within one business day. You may sign in after submitting this form, but
                          listing products and seller tools remain unavailable until approval is granted.
                        </p>
                        <p>
                          <strong>Operating standards.</strong> You agree to provide accurate product
                          listings, maintain sufficient inventory, fulfill orders promptly, and handle
                          customer communication professionally.
                        </p>
                        <p>
                          <strong>Enforcement.</strong> CArTGo may decline, suspend, or revoke seller
                          access for policy violations, misleading listings, or fraudulent activity.
                        </p>
                      </div>
                      <label className="portal-agreement__accept seller-checkbox">
                        <input
                          type="checkbox"
                          checked={signup.termsAccepted}
                          onChange={(e) =>
                            setSignup((current) => ({
                              ...current,
                              termsAccepted: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          I have read the Seller Agreement and acknowledge that access is granted only
                          after administrative approval, typically within one business day.
                        </span>
                      </label>
                    </section>
                  </div>
                ) : (
                  <div className="portal-form-grid fade-in">
                    <div className="portal-field portal-field--full">
                      <label className="field-label">Address line 1</label>
                      <input
                        className="field-input portal-input"
                        type="text"
                        value={signup.address1}
                        onChange={(e) => setSignup((current) => ({ ...current, address1: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="portal-field">
                      <label className="field-label">Postal code</label>
                      <input
                        className="field-input portal-input"
                        type="text"
                        value={signup.postalCode}
                        onChange={(e) => setSignup((current) => ({ ...current, postalCode: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="portal-signin-fields">
                <label className="field-label">Username</label>
                <input
                  className="field-input portal-input"
                  type="text"
                  placeholder="Your account username"
                  value={signin.username}
                  onChange={(e) => setSignin((current) => ({ ...current, username: e.target.value }))}
                  required
                />

                <label className="field-label">Password</label>
                <input
                  className="field-input portal-input"
                  type="password"
                  placeholder="Your account password"
                  value={signin.password}
                  onChange={(e) => setSignin((current) => ({ ...current, password: e.target.value }))}
                  required
                />
              </div>
            )}

            <footer className="portal-auth__footer">
              <div className="portal-auth__actions">
                {mode === "signup" && signupStage === 2 && (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setSignupStage(1)}
                  >
                    Back
                  </button>
                )}
                <button className="btn btn-primary" type="submit">
                  {mode === "signin"
                    ? "Sign in"
                    : signupStage === 1
                      ? "Continue to business profile"
                      : "Submit application"}
                </button>
              </div>

              <p className="portal-auth__switch">
                {mode === "signin" ? "New seller?" : "Already registered?"}
                <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Start application" : "Sign in"}
                </button>
              </p>
            </footer>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AuthPage;
