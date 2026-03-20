const QR_API = (url, size) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=07080d&color=00c97a&margin=10&format=png`;

export default function QRActions({ url, copied, onCopy }) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = QR_API(url, 600);
    link.download = "breakandchill-tournament-qr.png";
    link.target = "_blank";
    link.click();
  };

  return (
    <div className="qr-actions">
      <button
        className="action-btn"
        onClick={onCopy}
        style={{
          background: copied ? "rgba(0,201,122,0.15)" : "rgba(255,255,255,0.06)",
          color: copied ? "#00c97a" : "rgba(255,255,255,0.7)",
          border: `1px solid ${copied ? "rgba(0,201,122,0.4)" : "rgba(255,255,255,0.1)"}`,
        }}
      >
        <i className={`bi ${copied ? "bi-check-circle-fill" : "bi-clipboard"}`} style={{ marginRight: 6 }}></i>
        {copied ? "Copied!" : "Copy URL"}
      </button>
      <button
        className="action-btn"
        onClick={handleDownload}
        style={{
          background: "linear-gradient(135deg, #00c97a, #00a060)",
          color: "#001a0d",
        }}
      >
        <i className="bi bi-download" style={{ marginRight: 6 }}></i>
        Download QR
      </button>
    </div>
  );
}