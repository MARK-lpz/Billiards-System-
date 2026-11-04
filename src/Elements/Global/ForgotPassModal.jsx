import { useState, useEffect, useCallback } from "react";
import "../../styles/ForgotModal.css";
import { fetchResetChannels, resetPassword, sendResetCode } from "../../utils/passwordResetApi";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { MIN_PASSWORD_LENGTH } from "../../utils/passwordRules";
import { checkSignInUsername } from "../../utils/formValidation";

// Shows only the last four digits once the code is on its way.
const maskMobile = (phone) => `${phone.slice(0, 2)}•• ••• ${phone.slice(-4)}`;
// And only the start of an email address: "ju•••@gmail.com".
const maskEmail = (email) => {
  const [name, domain] = email.toLowerCase().split("@");
  return `${name.slice(0, 2)}•••@${domain}`;
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHANNELS = {
  email: { label: "Email", icon: "bi-envelope" },
  sms: { label: "Text message", icon: "bi-chat-dots" },
};

// One form for every staff account: the server finds whether the username is
// an admin's or an employee's, so no one has to pick first.
export default function ForgotPassModal({ visible, onClose }) {
  // The ways the server can send the code ("email", "sms"); null until asked,
  // empty when neither is set up.
  const [channels, setChannels] = useState(null);
  const [channel, setChannel] = useState("email");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
    setUsername("");
    setEmail("");
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

  // Asked each time the modal opens, so adding the Gmail app password or the
  // SMS key takes effect without anyone reloading the page.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    fetchResetChannels()
      .then((nextChannels) => {
        if (cancelled) return;
        setChannels(nextChannels);
        setChannel(nextChannels[0] || "email");
      })
      .catch(() => {
        // Unreachable server: let "Send Code" show the real error rather than
        // claiming reset is switched off.
        if (cancelled) return;
        setChannels(["email", "sms"]);
        setChannel("email");
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  // Without a way to send the code, knowing a username and an address or
  // number proves nothing, so the whole reset is off instead of offering a
  // way around the code.
  const loaded = channels !== null;
  const resetOff = loaded && channels.length === 0;
  const byEmail = channel === "email";
  const showPasswordFields = !resetOff && codeSent;
  const phoneWarning = getSmsWarning(phone);
  const contact = { channel, email: byEmail ? email.trim() : "", phone: byEmail ? "" : phone };

  const validateIdentity = () => {
    const usernameProblem = checkSignInUsername(username)?.hard;
    if (usernameProblem) {
      setError(usernameProblem);
      return false;
    }
    if (byEmail && !EMAIL_PATTERN.test(email.trim())) {
      setError("Please enter the email address saved in your Profile.");
      return false;
    }
    if (!byEmail && !isValidSmsNumber(phone)) {
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

    await sendResetCode({ username: username.trim(), ...contact });
    setCodeSent(true);
    setCode("");
    setInfo(
      byEmail
        ? `A 6-digit code was sent to ${maskEmail(email.trim())}. It expires in 10 minutes. Not in your inbox? Check Spam.`
        : `A 6-digit code was sent to ${maskMobile(phone)}. It expires in 10 minutes.`
    );
  };

  const submitReset = async () => {
    if (!validateIdentity()) return;
    if (!/^\d{6}$/.test(code)) {
      setError(`Enter the 6-digit code from the ${byEmail ? "email" : "text message"}.`);
      return;
    }
    if (!validateNewPassword()) return;

    // The server tells the admin's bell that it happened (never the password).
    await resetPassword({ username: username.trim(), ...contact, code, newPassword });
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
    if (resetOff || !loaded) return;
    runStep(codeSent ? submitReset : requestCode);
  };

  const description = resetOff
    ? ""
    : codeSent
      ? `Enter the code from the ${byEmail ? "email" : "text message"}, then choose a new password.`
      : byEmail
        ? "Enter your username and the email saved in your Profile. We will email you a 6-digit code."
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
              {description && <p className="forgot-description">{description}</p>}

              {resetOff && (
                <div className="forgot-notice">
                  <i className="bi bi-chat-dots"></i>
                  <span>
                    Password reset works by a code sent to your email or phone, which is not switched on yet. Until it
                    is, ask the admin to set a new password for you in Accounts.
                  </span>
                </div>
              )}

              {error && <div className="forgot-error">{error}</div>}
              {info && !error && <div className="forgot-info">{info}</div>}

              {!resetOff && !codeSent && loaded && channels.length > 1 && (
                <div className="forgot-channels" role="radiogroup" aria-label="Send the code by">
                  {channels.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={channel === option}
                      className={`forgot-channel${channel === option ? " is-on" : ""}`}
                      onClick={() => {
                        setChannel(option);
                        setError("");
                      }}
                      disabled={loading}
                    >
                      <i className={`bi ${CHANNELS[option].icon}`} aria-hidden="true"></i>
                      {CHANNELS[option].label}
                    </button>
                  ))}
                </div>
              )}

              {!resetOff && !codeSent && (
                <>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  {byEmail ? (
                    <>
                      <label className="form-label forgot-field-gap">Email in Your Profile</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={120}
                        value={email}
                        onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                        disabled={loading}
                      />
                      <p className="forgot-field-hint">
                        No email saved yet? Add it in Profile once you are signed in, or ask the admin to reset your password.
                      </p>
                    </>
                  ) : (
                    <>
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
                  <button type="submit" className="btn btn-success" disabled={loading || !loaded}>
                    {loading
                      ? "Please wait..."
                      : !loaded
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
