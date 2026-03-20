export default function QRURLInput({ inputVal, onInputChange, onApply }) {
  return (
    <div className="qr-section">
      <p className="qr-section-label">
        <i className="bi bi-link-45deg" style={{ marginRight: 6 }}></i>
        Form URL
      </p>
      <div className="qr-input-wrapper">
        <input
          className="url-input"
          value={inputVal}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="https://your-form-url.com"
        />
        <button className="apply-btn" onClick={onApply}>
          <i className="bi bi-check-lg" style={{ marginRight: 6 }}></i>
          Apply
        </button>
      </div>
    </div>
  );
}