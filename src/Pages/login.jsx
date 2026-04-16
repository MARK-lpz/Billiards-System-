import { useState } from "react";
import ForgotPassModal from "../Elements/Global/ForgotPassModal";
import "../styles/Login.css";

export default function Login({ onLogin, onGoToRegister }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { username, password } = e.target;
    const newErrors = {};

    // Client-side validation
    if (!username.value.trim()) newErrors.username = "Username is required";
    else if (username.value.trim().length < 3) newErrors.username = "Min 3 characters";

    if (!password.value) newErrors.password = "Password is required";
    else if (password.value.length < 6) newErrors.password = "Min 6 characters";

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

      // Store token and user data
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
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
                onChange={() => clearError("username")}
                disabled={loading}
              />
            </div>
            {errors.username && (
              <span className="error-message">
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
                className={`form-input ${errors.password ? "wrong password" : ""}`}
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