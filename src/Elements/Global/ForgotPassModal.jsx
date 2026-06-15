import { useState, useEffect, useCallback } from "react";
import "../../styles/ForgotModal.css";

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
  const [employeeNote, setEmployeeNote] = useState("");
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
    setEmployeeNote("");
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

  const addAdminNotification = (notification) => {
    const existingNotifications = JSON.parse(localStorage.getItem("adminNotifications") || "[]");
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify([
        {
          id: Date.now(),
          time: "Just now",
          unread: true,
          type: "password-reset",
          ...notification,
        },
        ...existingNotifications,
      ])
    );
  };

  const handleEmployeeRequest = () => {
    const username = employeeUsername.trim();
    if (!username) {
      setError("Please enter your employee username.");
      return false;
    }

    const requestId = Date.now();
    const request = {
      id: requestId,
      role: "employee",
      username,
      note: employeeNote.trim(),
      status: "pending-admin-approval",
      requestedAt: new Date().toISOString(),
    };

    const existingRequests = JSON.parse(localStorage.getItem("employeePasswordRequests") || "[]");
    localStorage.setItem("employeePasswordRequests", JSON.stringify([request, ...existingRequests]));
    addAdminNotification({
      message: `Employee password reset request from ${username}. Admin permission required.`,
      requestId,
      username,
      requestStatus: "pending-admin-approval",
    });
    setSuccessMessage("Your request has been sent to the admin. Please wait for approval before resetting your password.");
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

  const getApprovedEmployeeRequest = (username) => {
    try {
      const requests = JSON.parse(localStorage.getItem("employeePasswordRequests") || "[]");
      return requests.find(
        (request) =>
          request.username?.toLowerCase() === username.toLowerCase() &&
          request.status === "approved"
      );
    } catch {
      return null;
    }
  };

  const handleEmployeeResetCheck = () => {
    const username = employeeUsername.trim();
    if (!username) {
      setError("Please enter your employee username.");
      return false;
    }

    const approvedRequest = getApprovedEmployeeRequest(username);
    if (!approvedRequest) {
      return handleEmployeeRequest();
    }

    setVerifiedReset({ role: "employee", identifier: username, requestId: approvedRequest.id });
    return true;
  };

  const handlePasswordReset = () => {
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

    const resetRecord = {
      id: Date.now(),
      role: verifiedReset.role,
      identifier: verifiedReset.identifier,
      status: "password-reset",
      resetAt: new Date().toISOString(),
    };

    const resetKey = verifiedReset.role === "admin" ? "adminPasswordResetRequests" : "employeePasswordRequests";
    const existingRecords = JSON.parse(localStorage.getItem(resetKey) || "[]");
    const updatedRecords =
      verifiedReset.role === "employee"
        ? existingRecords.map((request) =>
            request.id === verifiedReset.requestId
              ? { ...request, status: "password-reset", resetAt: resetRecord.resetAt }
              : request
          )
        : [resetRecord, ...existingRecords];

    localStorage.setItem(resetKey, JSON.stringify(updatedRecords));
    localStorage.setItem(
      "passwordResetDrafts",
      JSON.stringify([
        {
          ...resetRecord,
          password: newPassword,
        },
        ...JSON.parse(localStorage.getItem("passwordResetDrafts") || "[]"),
      ])
    );

    setSuccessMessage(
      verifiedReset.role === "admin"
        ? "Admin password reset has been recorded."
        : "Employee password reset has been recorded."
    );
    return true;
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    window.setTimeout(() => {
      const ok = verifiedReset
        ? handlePasswordReset()
        : accountType === "employee"
          ? handleEmployeeResetCheck()
          : handleAdminRequest();
      if (ok) {
        setResetSuccess(Boolean(verifiedReset) || accountType === "employee");
      }
      setLoading(false);
    }, 250);
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
              <h3>{verifiedReset ? "Password reset recorded" : accountType === "employee" ? "Request sent" : "Reset request recorded"}</h3>
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
                  ? "Employee password reset requests need admin permission before the reset can continue."
                  : "Enter the registered Gmail address linked to the admin account."}
              </p>
              {error && <div className="forgot-error">{error}</div>}
              {verifiedReset ? (
                <>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <label className="form-label forgot-field-gap">Confirm Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </>
              ) : accountType === "employee" ? (
                <>
                  <label className="form-label">Employee Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter employee username"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <label className="form-label forgot-field-gap">Request Note</label>
                  <textarea
                    className="form-input forgot-textarea"
                    placeholder="Optional reason or contact detail"
                    value={employeeNote}
                    onChange={(e) => setEmployeeNote(e.target.value)}
                    disabled={loading}
                    rows={3}
                  />
                </>
              ) : (
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
              <div className="forgot-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading
                    ? "Processing..."
                    : verifiedReset
                      ? "Reset Password"
                    : accountType === "employee"
                      ? "Request Permission"
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
