import { useState } from "react";
import ForgotPassModal from "../Elements/Global/ForgotPassModal";
import { hasSignInEndedNote, saveSignedInUser } from "../utils/session";
import { checkSignInUsername } from "../utils/formValidation";
import "../styles/login.css";

export default function Login({ onLogin, onGoToRegister }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // Sent back here because the server ended the sign-in (see App.jsx).
  const [signInEnded] = useState(hasSignInEndedNote);
  // The username a "most likely a typo" warning was shown for on Login: pressing
  // Login again with it unchanged sends it anyway (an older account may have it).
  const [warnedUsername, setWarnedUsername] = useState("");

  // What is wrong with the username before it is sent, or "".
  const usernameMessage = (value, onLogin = false) => {
    const problem = checkSignInUsername(value);
    if (!problem) return "";
    if (problem.hard) return problem.hard;
    if (!onLogin) return problem.soft;
    const name = value.trim();
    if (warnedUsername === name) return "";
    setWarnedUsername(name);
    return `${problem.soft} If your username really is like this, press Login again.`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { username, password } = e.target;
    const newErrors = {};

    // Client-side validation
    const usernameProblem = usernameMessage(username.value, true);
    if (usernameProblem) newErrors.username = usernameProblem;

    // No length check here: passwords set before the 8-character minimum still sign in.
    if (!password.value) newErrors.password = "Password is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const loginData = {
      username: username.value.trim(),
      password: password.value,
    };

    try {
      setLoading(true);

      const response = await fetch('/api/log_in.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({
          username: data.message || "Invalid credentials",
          password: " "
        });
        return;
      }

      // Kept for this tab only, so another tab can be signed in as someone else.
      if (data.user) {
        saveSignedInUser(data.user, data.token);
      }

      // ✅ FIX: Extract role and pass it to onLogin
      const role = data.user?.role?.toLowerCase(); // 'admin' or 'employee'
      onLogin(role);

    } catch (error) {
      console.error('Login error:', error);
      setErrors({
        username: "Connection error. Please try again.",
        password: " "
      });
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: "" }));

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-wrapper">
          <img src="/Logo.png" alt="Break & Chill Logo" className="logo-img" />
        </div>

        <h1 className="title">BREAK &amp; CHILL</h1>
        <p className="subtitle">Billiard Hall Management System</p>

        {signInEnded && (
          <p className="login-notice" role="status">
            <i className="bi bi-info-circle" aria-hidden="true"></i>
            You were signed out (idle too long, or signed out on the server). Please sign in again.
          </p>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <i className="bi bi-person input-icon"></i>
              <input
                type="text"
                name="username"
                placeholder="Enter your Username"
                className={`form-input ${errors.username ? "input-error" : ""}`}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? "login-username-error" : undefined}
                onChange={() => clearError("username")}
                // Checked on leaving the field too, so a typo shows before Login.
                onBlur={(event) =>
                  event.target.value.trim() &&
                  setErrors((prev) => ({ ...prev, username: usernameMessage(event.target.value) }))
                }
                disabled={loading}
              />
            </div>
            {errors.username && (
              <span className="error-message" id="login-username-error" role="alert">
                <i className="bi bi-exclamation-circle"></i>
                {errors.username}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <i className="bi bi-lock input-icon"></i>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                className={`form-input ${errors.password ? "input-error" : ""}`}
                onChange={() => clearError("password")}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"} toggle-icon`}></i>
              </button>
            </div>
            {errors.password && errors.password.trim() && (
              <span className="error-message">
                <i className="bi bi-exclamation-circle"></i>
                {errors.password}
              </span>
            )}
          </div>

          <div className="forgot-password-wrapper">
            <button
              type="button"
              className="forgot-password forgot-password-button"
              onClick={(e) => {
                e.preventDefault();
                setShowForgotPassword(true);
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              <>
                Login
                <i className="bi bi-arrow-right arrow-icon"></i>
              </>
            )}
          </button>
        </form>

              {onGoToRegister && (
          <button 
            type="button"
            className="register-button"
            onClick={onGoToRegister}
          >
            <i className="bi bi-qr-code" style={{ marginRight: 8 }}></i>
            Tournament Registration
          </button>
        )}
        <ForgotPassModal
          visible={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />      </div>
    </div>
  );
}