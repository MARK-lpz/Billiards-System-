export default function AdminCredentialsManager({
  accounts,
  form,
  message,
  onChange,
  onSelect,
  onSubmit,
}) {
  return (
    <section className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h2 className="audit-log-header">Admin Credentials</h2>
            <p>Update an existing admin username or password. Admin accounts cannot be created here.</p>
          </div>
        </div>

        {accounts.length ? (
          <form className="account-form account-form--credentials" onSubmit={onSubmit}>
            <select value={form.id || ""} onChange={(event) => onSelect(event.target.value)}>
              <option value="">Select admin account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.username}</option>
              ))}
            </select>
            <input
              required
              placeholder="Username"
              value={form.username}
              onChange={(event) => onChange("username", event.target.value)}
            />
            <input
              type="password"
              placeholder="New password (optional)"
              value={form.password}
              onChange={(event) => onChange("password", event.target.value)}
            />
            <button type="submit" className="btn btn-success" disabled={!form.id}>
              <i className="bi bi-key me-2"></i>
              Update Admin Credentials
            </button>
          </form>
        ) : (
          <p className="account-message">No admin account is available to update.</p>
        )}

        {message && <p className="account-message">{message}</p>}
      </div>
    </section>
  );
}
