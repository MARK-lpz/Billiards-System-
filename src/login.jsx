import { useState } from "react";
import "./styles/login.css";

export default function Login({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = () => setShowPassword((prev) => !prev);

  const handleLogin = (e) => {
  e.preventDefault();
  onLogin();
};

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="logo-wrapper">
         <img src="../Logo.png" alt="Break and Chill Logo" className="logo-img"/>
        </div>

        {/* Title */}
        <h1 className="title">BREAK &amp; CHILL</h1>
        <p className="subtitle">Billiard Hall Management System</p>

        {/* Form */}
        <form className="login-form" onSubmit={handleLogin}>
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <i className="bi bi-person input-icon"></i>
              <input
                type="text"
                name="username"
                id="userID"
                placeholder="Enter your Username"
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <i className="bi bi-lock input-icon"></i>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                placeholder="Enter your password"
                className="form-input"
                required
              />
              <button type="button" className="password-toggle" onClick={togglePassword}>
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"} toggle-icon`}></i>
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="forgot-password-wrapper">
            <a href="#" className="forgot-password">
              Forgot Password?
            </a>
          </div>

          {/* Login Button */}
          <button type="submit" className="login-button">
            Login
            <i className="bi bi-arrow-right arrow-icon"></i>
          </button>
        </form>

      </div>
    </div>
  );
}