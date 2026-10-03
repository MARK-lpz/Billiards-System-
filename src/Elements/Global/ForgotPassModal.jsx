import { useState, useEffect, useCallback } from "react";
import "../../styles/ForgotModal.css";
import { fetchResetMode, resetPassword, sendResetCode } from "../../utils/passwordResetApi";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { MIN_PASSWORD_LENGTH } from "../../utils/passwordRules";

// Shows only the last four digits once the code is on its way.
const maskMobile = (phone) => `${phone.slice(0, 2)}•• ••• ${phone.slice(-4)}`;

export default function ForgotPassModal({ visible, onClose }) {
  const [accountType, setAccountType] = useState("employee");
  // "sms-code" when texting is set up on the server, otherwise "disabled".
  const [mode, setMode] = useState(null);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = useCallback(() => {
    setAccountType("employee");
    setUsername("");
    setPhone("");
    setCode("");
    setCodeSent(false);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setInfo("");
    setResetSuccess(false);
    setLoading(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, handleClose]);

  // Asked each time the modal opens, so adding the SMS key takes effect
  // without anyone reloading the page.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    fetchResetMode()
      .then((nextMode) => {
        if (!cancelled) setMode(nextMode);
      })
      .catch(() => {
        // Unreachable server: let "Send Code" show the real error rather than
        // claiming reset is switched off.
        if (!cancelled) setMode("sms-code");
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  // Without texting, knowing a username and number proves nothing, so the
  // whole reset is off instead of offering a way around the code.
  const resetOff = mode === "disabled";
  const showPasswordFields = !resetOff && codeSent;
  const phoneWarning = getSmsWarning(phone);

  // Tells the admin that a reset happened. Carries no password, by design.
  const notifyAdminOfReset = (resetUsername) => {
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
            message: `${resetUsername} reset their own password.`,
            username: resetUsername,
          },
          ...existing,
        ])
      );
    } catch {
      // A missing notification must never block the user from signing in.
    }
  };

  const validateIdentity = () => {
    if (!username.trim()) {
      setError(`Please enter your ${accountType} username.`);
      return false;
    }
    if (!isValidSmsNumber(phone)) {
      setError("Please enter your registered mobile number in 09XXXXXXXXX format.");
      return false;
    }
    return true;
  };

  const validateNewPassword = () => {
    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm the new password.");
      return false;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const requestCode = async () => {
    if (!validateIdentity()) return;

    await sendResetCode({ username: username.trim(), role: accountType, phone });
    setCodeSent(true);
    setCode("");
    setInfo(`A 6-digit code was sent to ${maskMobile(phone)}. It expires in 10 minutes.`);
  };

  const submitReset = async () => {
    if (!validateIdentity()) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the text message.");
      return;
    }
    if (!validateNewPassword()) return;

    await resetPassword({ username: username.trim(), role: accountType, phone, code, newPassword });

    notifyAdminOfReset(username.trim());
    setResetSuccess(true);
  };

  const runStep = async (step) => {
    setError("");
    setLoading(true);
    try {
      await step();
    } catch (requestError) {
      setError(requestError?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (resetOff || !mode) return;
    runStep(codeSent ? submitReset : requestCode);
  };

  const switchAccountType = (nextType) => {
    setAccountType(nextType);
    setError("");
    setInfo("");
  };

  const description = resetOff
    ? ""
    : codeSent
      ? "Enter the code from the text message, then choose a new password."
      : "Enter your username and registered mobile number. We will text you a 6-digit code.";

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
              <h3>Password changed</h3>
              <p>Your password has been changed. You can sign in with it now.</p>
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {!codeSent && (
                <div className="forgot-role-tabs">
                  <button
                    type="button"
                    className={`forgot-role-tab ${accountType === "employee" ? "active" : ""}`}
                    onClick={() => switchAccountType("employee")}
                  >
                    <i className="bi bi-person-badge"></i>
                    Employee
                  </button>
                  <button
                    type="button"
                    className={`forgot-role-tab ${accountType === "admin" ? "active" : ""}`}
                    onClick={() => switchAccountType("admin")}
                  >
                    <i className="bi bi-shield-lock"></i>
                    Admin
                  </button>
                </div>
              )}

              {description && <p className="forgot-description">{description}</p>}

              {resetOff && (
                <div className="forgot-notice">
                  <i className="bi bi-chat-dots"></i>
                  <span>
                    Password reset works by a code sent to your phone, which is not switched on yet.{" "}
                    {accountType === "admin"
                      ? "Until it is, the admin password can only be changed from Account Management by a signed-in admin."
                      : "Until it is, please ask the admin for help signing in."}
                  </span>
                </div>
              )}

              {error && <div className="forgot-error">{error}</div>}
              {info && !error && <div className="forgot-info">{info}</div>}

              {!resetOff && !codeSent && (
                <>
                  <label className="form-label">{accountType === "admin" ? "Admin" : "Employee"} Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Enter ${accountType} username`}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <label className="form-label forgot-field-gap">Registered Mobile Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="09XXXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                    disabled={loading}
                  />
                  {phoneWarning && <p className="forgot-field-warning">{phoneWarning}</p>}
                </>
              )}

              {!resetOff && codeSent && (
                <>
                  <label className="form-label">6-Digit Code</label>
                  <input
                    type="text"
                    className="form-input forgot-code-input"
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="forgot-link-btn"
                    onClick={() => runStep(requestCode)}
                    disabled={loading}
                  >
                    Didn&apos;t get it? Send a new code
                  </button>
                </>
              )}

              {showPasswordFields && (
                <>
                  <label className="form-label forgot-field-gap">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
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
                  {resetOff ? "Close" : "Cancel"}
                </button>
                {!resetOff && (
                  <button type="submit" className="btn btn-success" disabled={loading || !mode}>
                    {loading
                      ? "Please wait..."
                      : !mode
                        ? "Loading..."
                        : codeSent
                          ? "Reset Password"
                          : "Send Code"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
