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
            <h2 className="audit-log-header">Employee Accounts</h2>
            <p>Create an employee account or update an employee username and password.</p>
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
          <button type="submit" className="btn btn-success">
            <i className="bi bi-person-plus me-2"></i>
            {accountForm.id ? "Update Employee" : "Create Employee"}
          </button>
        </form>

        {accountMessage && <p className="account-message">{accountMessage}</p>}

        <div className="account-list">
          {accounts.map((account) => (
            <div key={account.id || account.username} className="account-row">
              <div>
                <strong>{account.username}</strong>
                <span>
                  Employee
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
