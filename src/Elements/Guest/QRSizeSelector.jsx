export default function QRSizeSelector({ qrSize, onSizeChange }) {
  return (
    <div className="qr-section">
      <p className="qr-section-label">
        <i className="bi bi-arrows-angle-expand" style={{ marginRight: 6 }}></i>
        QR Size
      </p>
      <div className="qr-size-buttons">
        {[200, 280, 360].map(s => (
          <button 
            key={s} 
            className={`size-btn ${qrSize === s ? "active" : ""}`}
            onClick={() => onSizeChange(s)}
          >
            {s === 200 ? "Small" : s === 280 ? "Medium" : "Large"}
          </button>
        ))}
      </div>
    </div>
  );
}