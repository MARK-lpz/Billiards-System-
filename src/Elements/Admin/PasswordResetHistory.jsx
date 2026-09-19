const formatWhen = (value) => {
  if (!value) return "Unknown time";

  const parsed = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function PasswordResetHistory({ resets = [], message = "" }) {
  return (
    <section className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h2 className="audit-log-header">Password Resets</h2>
            <p>Staff who reset their own password. Passwords are never shown here or stored for viewing.</p>
          </div>
        </div>

        {message && <p className="account-message">{message}</p>}

        {resets.length ? (
          <ul className="password-reset-list">
            {resets.map((entry) => (
              <li key={entry.id} className="password-reset-row">
                <span className="password-reset-user">
                  <i className="bi bi-person-fill" aria-hidden="true"></i>
                  {entry.username}
                  <span className="password-reset-role">{entry.role}</span>
                </span>
                <span className="password-reset-when">{formatWhen(entry.resetAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="password-reset-empty">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
            No password resets recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}
