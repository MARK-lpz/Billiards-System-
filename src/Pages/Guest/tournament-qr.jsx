import "../../styles/Guest/Qr/Qrbase.css";
import "../../styles/Guest/Qr/QrHeader.css";
import "../../styles/Guest/Qr/QrDisplay.css";
import "../../styles/Guest/Qr/QrResponsive.css";

const QR_API = (url, size, theme) => {
  const bg = theme === "light" ? "ffffff" : "07080d";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=${bg}&color=00c97a&margin=10&format=png`;
};

export default function TournamentQR({ onNavigateToForm, onBackToLogin, theme }) {
  const url = "https://breakandchill.com/";
  const qrSize = 280;
  const isLight = theme === "light";

  return (
    <div className={`qr-container guest-view${isLight ? " light" : ""}`}>
      <div className="qr-wrapper">

        {/* Header */}
        <div className="qr-header fade-in">
          <div className="qr-header-line-wrapper" />
          <img
            src="/Logo.png"
            alt="Break & Chill Logo"
            className="qr-header-logo"
          />
          <p className="qr-header-subtitle">
            <i className="bi bi-qr-code" style={{ marginRight: 6 }}></i>
            Tournament Registration · QR Code
          </p>
        </div>

        {/* Card */}
        <div className="qr-card fade-in">
          <div className="qr-card-top-line" />
          <div className="qr-display-wrapper">
            <div className="qr-display-box">
              <div className="qr-corner qr-corner-tl" />
              <div className="qr-corner qr-corner-tr" />
              <div className="qr-corner qr-corner-bl" />
              <div className="qr-corner qr-corner-br" />
              <img
                src={QR_API(url, qrSize * 2, theme)}
                alt="Tournament QR Code"
                className="qr-glow"
                style={{ width: qrSize, height: qrSize, display: "block" }}
              />
            </div>
          </div>
          <p className="qr-scan-label">
            <i className="bi bi-phone" style={{ marginRight: 6 }}></i>
            Scan to Register
          </p>
        </div>

        <p className="qr-footer">2026 Break & Chill Billiards</p>

        {onNavigateToForm && (
          <button className="qr-navigate-btn" onClick={onNavigateToForm}>
            <i className="bi bi-pencil-square" style={{ marginRight: 8 }}></i>
            Go to Registration Form
          </button>
        )}

        {onBackToLogin && (
          <button className="qr-navigate-btn qr-navigate-btn--secondary" onClick={onBackToLogin}>
            <i className="bi bi-box-arrow-left" style={{ marginRight: 8 }}></i>
            Back to Login
          </button>
        )}

      </div>
    </div>
  );
}
