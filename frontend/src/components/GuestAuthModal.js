import { useNavigate } from "react-router-dom";
import "../pages/AuthPage.css";

function GuestAuthModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const goToSignIn = () => {
    onClose();
    // Preserve current path as redirect after successful login
    const redirect = encodeURIComponent(window.location.pathname);
    navigate(`/login?redirect=${redirect}`);
  };

  const goToSignUp = () => {
    onClose();
    // Preserve current path as redirect after successful signup
    const redirect = encodeURIComponent(window.location.pathname);
    navigate(`/login?mode=signup&redirect=${redirect}`);
  };

  return (
    <div className="modal-overlay">
      <div className="auth-modal-card fade-in">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="auth-prompt">
          <h2>Welcome to CArTGo</h2>
          <p className="subtext">Sign in to your account or create a new one to continue shopping.</p>

          <div className="auth-prompt-actions">
            <button type="button" className="btn btn-primary" onClick={goToSignIn}>
              Sign In
            </button>
            <button type="button" className="btn btn-secondary" onClick={goToSignUp}>
              Create Account
            </button>
          </div>

          <button type="button" className="btn btn-link" onClick={onClose}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuestAuthModal;
