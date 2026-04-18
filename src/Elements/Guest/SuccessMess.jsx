export default function SuccessMessage({ form, onReset }) {
  return (
    <div className="success-container success-bounce">
      <div className="success-icon">
        <i className="bi bi-trophy-fill"></i>
      </div>

      <h2 className="success-title">
        <i className="bi bi-check-circle-fill" style={{ marginRight: 8, color: '#00c97a' }}></i>
        You're Registered!
      </h2>
      <p className="success-message">Good luck in the tournament, {form.firstName}!</p>

      <div className="success-details">
        {[
          ["Tournament", form.eventName || "Selected Event", "bi-trophy"],
          ["Name", `${form.firstName} ${form.lastName}`, "bi-person-fill"],
          ["Contact", form.contact, "bi-telephone-fill"],
          ["Email", form.email, "bi-envelope-fill"],
          ["Age", form.age, "bi-calendar-fill"],
          ["Game Type", form.gameType, "bi-circle-fill"],
          ["Format", form.format, "bi-trophy"],
          ["Skill Level", form.skillLevel, "bi-star-fill"],
          ...(form.teamName ? [["Team / Nickname", form.teamName, "bi-people-fill"]] : []),
        ].map(([label, value, icon]) => (
          <div key={label} className="detail-row">
            <span className="detail-label">
              <i className={`bi ${icon}`} style={{ marginRight: 6 }}></i>
              {label}
            </span>
            <span className="detail-value">{value}</span>
          </div>
        ))}
      </div>

      <button 
        onClick={onReset} 
        className="submit-btn"
        style={{ background: "rgba(255,255,255,0.07)", color: "#fff" }}
      >
        <i className="bi bi-arrow-clockwise" style={{ marginRight: 8 }}></i>
        Register Another Player
      </button>
    </div>
  );
}
