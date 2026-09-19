import { useState, useEffect, useCallback } from "react";
import "../../styles/ForgotModal.css";
import { resetEmployeePassword } from "../../utils/passwordResetApi";

const DEFAULT_ADMIN_GMAILS = ["admin@gmail.com"];

const getRegisteredAdminGmails = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("adminRegisteredGmails") || "null");
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_ADMIN_GMAILS;
  } catch {
    return DEFAULT_ADMIN_GMAILS;
  }
};

export default function ForgotPassModal({ visible, onClose }) {
  const [accountType, setAccountType] = useState("employee");
  const [resetEmail, setResetEmail] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [verifiedReset, setVerifiedReset] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    setAccountType("employee");
    setResetEmail("");
    setEmployeeUsername("");
    setEmployeeEmail("");
    setVerifiedReset(null);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setResetSuccess(false);
    setSuccessMessage("");
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

  // Tells the admin that a reset happened. Carries no password, by design.
  const notifyAdminOfReset = (username) => {
    try {
      const existing = JSON.parse(localStorage.getItem("adminNotifications") || "[]");
      localStorage.setItem(
        "adminNotifications",
        JSON.stringify([
          {
            id: Date.now(),
            time: "Just now",
            unread: true,
            type: "password-reset",
            message: `${username} reset their own password.`,
            username,
          },
          ...existing,
        ])
      );
    } catch {
      // A missing notification must never block the employee from signing in.
    }
  };

  const validateNewPassword = () => {
    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm the new password.");
      return false;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    return true;
  };

  // Employees reset their own password. No admin approval, no waiting.
  const handleEmployeeReset = async () => {
    const username = employeeUsername.trim();
    const email = employeeEmail.trim();

    if (!username) {
      setError("Please enter your employee username.");
      return false;
    }

    if (!email) {
      setError("Please enter the email registered to your account.");
      return false;
    }

    if (!validateNewPassword()) return false;

    try {
      await resetEmployeePassword({ username, email, newPassword });
    } catch (requestError) {
      setError(requestError?.message || "Unable to reset the password right now.");
      return false;
    }

    notifyAdminOfReset(username);
    setSuccessMessage("Your password has been changed. You can sign in with it now.");
    return true;
  };

  const handleAdminRequest = () => {
    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setError("Please enter your registered Gmail address.");
      return false;
    }

    const emailPattern = /^[^\s@]+@gmail\.com$/i;
    if (!emailPattern.test(email)) {
      setError("Admin password reset requires a registered Gmail address.");
      return false;
    }

    const registeredGmails = getRegisteredAdminGmails().map((entry) => String(entry).toLowerCase());
    if (!registeredGmails.includes(email)) {
      setError("This Gmail is not registered for the admin account.");
      return false;
    }

    setVerifiedReset({ role: "admin", identifier: email });
    return true;
  };

  const handleAdminPasswordReset = () => {
    if (!validateNewPassword()) return false;

    const resetRecord = {
      id: Date.now(),
      role: "admin",
      identifier: verifiedReset.identifier,
      status: "password-reset",
      resetAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("adminPasswordResetRequests") || "[]");
      localStorage.setItem("adminPasswordResetRequests", JSON.stringify([resetRecord, ...existing]));
    } catch {
      // Recording is best effort; it must not swallow the reset itself.
    }

    setSuccessMessage("Admin password reset has been recorded.");
    return true;
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const ok = verifiedReset
        ? handleAdminPasswordReset()
        : accountType === "employee"
          ? await handleEmployeeReset()
          : handleAdminRequest();

      if (ok) {
        setResetSuccess(Boolean(verifiedReset) || accountType === "employee");
      }
    } finally {
      setLoading(false);
    }
  };

  const showPasswordFields = Boolean(verifiedReset) || accountType === "employee";

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
              <h3>{accountType === "employee" && !verifiedReset ? "Password changed" : "Password reset recorded"}</h3>
              <p>{successMessage}</p>
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword}>
              {!verifiedReset && (
                <div className="forgot-role-tabs">
                  <button
                    type="button"
                    className={`forgot-role-tab ${accountType === "employee" ? "active" : ""}`}
                    onClick={() => {
                      setAccountType("employee");
                      setError("");
                    }}
                  >
                    <i className="bi bi-person-badge"></i>
                    Employee
                  </button>
                  <button
                    type="button"
                    className={`forgot-role-tab ${accountType === "admin" ? "active" : ""}`}
                    onClick={() => {
                      setAccountType("admin");
                      setError("");
                    }}
                  >
                    <i className="bi bi-shield-lock"></i>
                    Admin
                  </button>
                </div>
              )}

              <p className="forgot-description">
                {verifiedReset
                  ? `Set a new password for ${verifiedReset.identifier}.`
                  : accountType === "employee"
                    ? "Confirm your username and the email registered to your account, then choose a new password. Only you will know it."
                    : "Enter the registered Gmail address linked to the admin account."}
              </p>

              {error && <div className="forgot-error">{error}</div>}

              {!verifiedReset && accountType === "employee" && (
                <>
                  <label className="form-label">Employee Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter employee username"
                    autoComplete="username"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <label className="form-label forgot-field-gap">Registered Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="The email on your account"
                    autoComplete="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    disabled={loading}
                  />
                </>
              )}

              {!verifiedReset && accountType === "admin" && (
                <>
                  <label className="form-label">Registered Gmail Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="adminname@gmail.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </>
              )}

              {showPasswordFields && (
                <>
                  <label className={`form-label ${verifiedReset ? "" : "forgot-field-gap"}`}>New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    autoFocus={Boolean(verifiedReset)}
                  />
                  <label className="form-label forgot-field-gap">Confirm Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                  <p className="forgot-privacy-note">
                    <i className="bi bi-shield-lock-fill"></i>
                    Your new password is sent straight to the server. The admin can see that you reset it, never what it is.
                  </p>
                </>
              )}

              <div className="forgot-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading
                    ? "Processing..."
                    : showPasswordFields
                      ? "Reset Password"
                      : "Submit Gmail"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
