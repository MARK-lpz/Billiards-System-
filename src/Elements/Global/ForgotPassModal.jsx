import { useState, useEffect, useCallback } from "react";
import "../../styles/ForgotModal.css";

export default function ForgotPassModal({ visible, onClose }) {
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    setResetEmail("");
    setError("");
    setResetSuccess(false);
    setLoading(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, handleClose]);

  if (!visible) return null;

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const email = resetEmail.trim();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetSuccess(true);
      } else {
        setError(data.message || "Failed to send reset email. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-modal">
      <div className="forgot-modal-overlay" onClick={handleClose} />
      <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="forgot-modal-header">
          <h2>Reset Password</h2>
          <button type="button" className="forgot-close-btn" onClick={handleClose}>
            <i className="bi bi-x"></i>
          </button>
        </div>

        <div className="forgot-modal-body">
          {resetSuccess ? (
            <div className="forgot-success">
              <i className="bi bi-check-circle-fill success-icon"></i>
              <h3>Reset email sent!</h3>
              <p>
                A password reset link has been sent to <strong>{resetEmail}</strong>.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <p className="forgot-description">
                Enter the email address linked to your account and we’ll send instructions to reset your password.
              </p>
              {error && <div className="forgot-error">{error}</div>}
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <div className="forgot-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
