import { useEffect, useMemo, useState } from "react";
import "../../styles/Admin/Audit.css";
import AuditAccountManager from "../../Elements/Admin/AuditAccountManager";
import AuditDetailModal from "../../Elements/Admin/AuditDetailModal";
import AuditLogList from "../../Elements/Admin/AuditLogList";
import AuditTrailStats from "../../Elements/Admin/AuditTrailStats";
import { appendAuditLog, normalizeAuditLogs } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";

const emptyAccountForm = {
  id: null,
  username: "",
  password: "",
  role: "employee",
  email: "",
  fullName: "",
  phone: "",
};

export default function AuditTrail({ logs = [], setLogs }) {
  const { addNotification } = useNotifications();
  const normalizedLogs = useMemo(() => normalizeAuditLogs(logs), [logs]);
  const [filter, setFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);
  const [accounts, setAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("adminManagedAccounts") || "[]");
    } catch {
      return [];
    }
  });
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountMessage, setAccountMessage] = useState("");

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
        setAccountMessage("Account API unavailable; showing local saved accounts.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("adminManagedAccounts", JSON.stringify(accounts));
  }, [accounts]);

  const counts = useMemo(
    () => ({
      total: normalizedLogs.length,
      issues: normalizedLogs.filter((log) => log.type === "issue").length,
      reservations: normalizedLogs.filter((log) => log.type === "reservation").length,
      customer: normalizedLogs.filter((log) => log.customer?.previous || log.customer?.current).length,
      employee: normalizedLogs.filter((log) => log.staff === "Employee").length,
    }),
    [normalizedLogs]
  );

  const filteredLogs = useMemo(() => {
    if (filter === "all") return normalizedLogs;
    if (filter === "customer") {
      return normalizedLogs.filter((log) => log.customer?.previous || log.customer?.current);
    }
    if (filter === "employee") {
      return normalizedLogs.filter((log) => log.staff === "Employee");
    }
    return normalizedLogs.filter((log) => log.type === filter);
  }, [filter, normalizedLogs]);

  const filters = useMemo(
    () => [
      { id: "all", label: "All", count: counts.total },
      { id: "customer", label: "Customer Changes", count: counts.customer },
      { id: "employee", label: "Employee Activity", count: counts.employee },
      { id: "reservation", label: "Reservations", count: counts.reservations },
      {
        id: "table",
        label: "Tables",
        count: normalizedLogs.filter((log) => log.type === "table").length,
      },
      { id: "issue", label: "Issues", count: counts.issues },
    ],
    [counts, normalizedLogs]
  );

  const updateAccountField = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetAccountForm = () => {
    setAccountForm(emptyAccountForm);
  };

  const saveAccount = async (event) => {
    event.preventDefault();

    const payload = {
      username: accountForm.username.trim(),
      password: accountForm.password,
      role: accountForm.role,
      email: accountForm.email.trim(),
      fullName: accountForm.fullName.trim(),
      phone: accountForm.phone.trim(),
    };

    if (!payload.username || (!accountForm.id && !payload.password)) {
      setAccountMessage("Username and password are required for a new account.");
      return;
    }

    let savedAccount = { ...payload, id: accountForm.id || Date.now() };

    try {
      const response = await fetch("/api/users.php", {
        method: accountForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: accountForm.id }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Unable to save account.");

      savedAccount = data.user || savedAccount;
      setAccountMessage("Account saved to database.");
    } catch (error) {
      const message = error.message || "Account saved locally.";
      setAccountMessage(`${message} Local account list updated.`);
    }

    setAccounts((prev) => {
      const sanitizedAccount = { ...savedAccount, password: undefined };
      const exists = prev.some((account) => account.id === savedAccount.id);

      return exists
        ? prev.map((account) => (account.id === savedAccount.id ? sanitizedAccount : account))
        : [sanitizedAccount, ...prev];
    });

    if (setLogs) {
      appendAuditLog(setLogs, {
        type: "auth",
        staff: "Admin",
        action: accountForm.id ? "Updated employee account" : "Created employee account",
        detail: `${payload.role} account ${payload.username} was ${accountForm.id ? "updated" : "created"}.`,
        entity: "user",
      });
    }

    addNotification({
      message: `${payload.username} ${accountForm.id ? "account updated" : "account created"}.`,
    });

    resetAccountForm();
  };

  const editAccount = (account) => {
    setAccountForm({
      id: account.id,
      username: account.username || "",
      password: "",
      role: account.role || "employee",
      email: account.email || "",
      fullName: account.fullName || account.full_name || "",
      phone: account.phone || "",
    });
  };

  return (
    <div className="audit-trail-container">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Audit Trail</h1>
        <p className="audit-trail-subtitle">
          Record and track all admin and employee activity across the system
        </p>
      </div>

      <AuditTrailStats counts={counts} />

      <AuditAccountManager
        accounts={accounts}
        accountForm={accountForm}
        accountMessage={accountMessage}
        onChange={updateAccountField}
        onClear={resetAccountForm}
        onEdit={editAccount}
        onSubmit={saveAccount}
      />

      <AuditLogList
        filter={filter}
        filters={filters}
        logs={filteredLogs}
        onFilterChange={setFilter}
        onSelectLog={setSelectedLog}
      />

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
