export default function AuditAccountManager({
  accounts,
  accountForm,
  accountMessage,
  onChange,
  onClear,
  onEdit,
  onSubmit,
}) {
  return (
    <div className="card account-management-card">
      <div className="card-body">
        <div className="account-management-header">
          <div>
            <h6 className="audit-log-header">Manage Employee Accounts</h6>
            <p>Create admin/employee accounts or update employee passwords and details.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            Clear
          </button>
        </div>

        <form className="account-form" onSubmit={onSubmit}>
          <input
            placeholder="Username"
            value={accountForm.username}
            onChange={(event) => onChange("username", event.target.value)}
          />
          <input
            placeholder="New password"
            type="password"
            value={accountForm.password}
            onChange={(event) => onChange("password", event.target.value)}
          />
          <select value={accountForm.role} onChange={(event) => onChange("role", event.target.value)}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          <input
            placeholder="Gmail"
            type="email"
            value={accountForm.email}
            onChange={(event) => onChange("email", event.target.value)}
          />
          <input
            placeholder="Full name"
            value={accountForm.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
          />
          <input
            placeholder="Phone"
            value={accountForm.phone}
            onChange={(event) => onChange("phone", event.target.value)}
          />
          <button type="submit" className="btn btn-success">
            <i className="bi bi-person-plus me-2"></i>
            {accountForm.id ? "Update Account" : "Create Account"}
          </button>
        </form>

        {accountMessage && <p className="account-message">{accountMessage}</p>}

        <div className="account-list">
          {accounts.map((account) => (
            <div key={account.id || account.username} className="account-row">
              <div>
                <strong>{account.username}</strong>
                <span>
                  {account.role}
                  {account.email ? ` - ${account.email}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => onEdit(account)}
              >
                <i className="bi bi-pencil"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
