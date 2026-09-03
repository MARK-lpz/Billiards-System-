import { useEffect, useMemo, useState } from "react";
import "../../styles/Admin/Audit.css";
import AdminCredentialsManager from "../../Elements/Admin/AdminCredentialsManager";
import AuditAccountManager from "../../Elements/Admin/AuditAccountManager";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";

const emptyCredentialForm = { id: null, username: "", password: "" };

export default function AccountManagement({ setLogs }) {
  const { addNotification } = useNotifications();
  const [accounts, setAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("adminManagedAccounts") || "[]");
    } catch {
      return [];
    }
  });
  const [adminForm, setAdminForm] = useState(emptyCredentialForm);
  const [employeeForm, setEmployeeForm] = useState(emptyCredentialForm);
  const [adminMessage, setAdminMessage] = useState("");
  const [employeeMessage, setEmployeeMessage] = useState("");

  const adminAccounts = useMemo(
    () => accounts.filter((account) => account.role === "admin"),
    [accounts]
  );
  const employeeAccounts = useMemo(
    () => accounts.filter((account) => account.role !== "admin"),
    [accounts]
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/users.php")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (!cancelled && Array.isArray(data.users)) {
          setAccounts(data.users);
          localStorage.setItem("adminManagedAccounts", JSON.stringify(data.users));
        }
      })
      .catch(() => {
        if (!cancelled) setEmployeeMessage("Account API unavailable; showing local saved accounts.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("adminManagedAccounts", JSON.stringify(accounts));
  }, [accounts]);

  const updateAccountList = (savedAccount) => {
    const sanitizedAccount = { ...savedAccount, password: undefined };
    setAccounts((previous) => {
      const exists = previous.some((account) => String(account.id) === String(savedAccount.id));
      return exists
        ? previous.map((account) => (String(account.id) === String(savedAccount.id) ? sanitizedAccount : account))
        : [sanitizedAccount, ...previous];
    });
  };

  const persistAccount = async ({ form, role, allowCreate, setMessage }) => {
    const username = form.username.trim();
    const isUpdate = Boolean(form.id);
    const existingAccount = accounts.find((account) => String(account.id) === String(form.id));

    if (!username || (!isUpdate && !form.password)) {
      setMessage("Username and password are required for a new employee account.");
      return false;
    }
    if (!isUpdate && !allowCreate) {
      setMessage("Admin accounts cannot be created from this page.");
      return false;
    }

    const payload = {
      id: form.id,
      username,
      password: form.password,
      role,
      email: existingAccount?.email || "",
      fullName: existingAccount?.fullName || existingAccount?.full_name || "",
      phone: existingAccount?.phone || "",
    };
    let savedAccount = { ...payload, id: form.id || Date.now() };

    try {
      const response = await fetch("/api/users.php", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save account.");

      savedAccount = data.user || savedAccount;
      setMessage("Account saved to database.");
    } catch (error) {
      setMessage(`${error.message || "Account saved locally."} Local account list updated.`);
    }

    updateAccountList(savedAccount);
    appendAuditLog(setLogs, {
      type: "auth",
      staff: "Admin",
      action: isUpdate ? `Updated ${role} credentials` : "Created employee account",
      detail: `${role} account ${username} was ${isUpdate ? "updated" : "created"}.`,
      entity: "user",
    });
    addNotification({ message: `${username} ${isUpdate ? "credentials updated" : "employee account created"}.` });
    return true;
  };

  const selectAdmin = (id) => {
    const account = adminAccounts.find((item) => String(item.id) === String(id));
    setAdminForm(account ? { id: account.id, username: account.username || "", password: "" } : emptyCredentialForm);
    setAdminMessage("");
  };

  const saveAdmin = async (event) => {
    event.preventDefault();
    const saved = await persistAccount({
      form: adminForm,
      role: "admin",
      allowCreate: false,
      setMessage: setAdminMessage,
    });
    if (saved) setAdminForm((previous) => ({ ...previous, password: "" }));
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    const saved = await persistAccount({
      form: employeeForm,
      role: "employee",
      allowCreate: true,
      setMessage: setEmployeeMessage,
    });
    if (saved) setEmployeeForm(emptyCredentialForm);
  };

  const editEmployee = (account) => {
    setEmployeeForm({ id: account.id, username: account.username || "", password: "" });
    setEmployeeMessage("");
  };

  return (
    <div className="audit-trail-container account-management-page">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Account Management</h1>
        <p className="audit-trail-subtitle">Manage admin credentials and employee accounts separately.</p>
      </div>

      <div className="account-management-sections">
        <AdminCredentialsManager
          accounts={adminAccounts}
          form={adminForm}
          message={adminMessage}
          onChange={(field, value) => setAdminForm((previous) => ({ ...previous, [field]: value }))}
          onSelect={selectAdmin}
          onSubmit={saveAdmin}
        />

        <AuditAccountManager
          accounts={employeeAccounts}
          accountForm={employeeForm}
          accountMessage={employeeMessage}
          onChange={(field, value) => setEmployeeForm((previous) => ({ ...previous, [field]: value }))}
          onClear={() => {
            setEmployeeForm(emptyCredentialForm);
            setEmployeeMessage("");
          }}
          onEdit={editEmployee}
          onSubmit={saveEmployee}
        />
      </div>
    </div>
  );
}
