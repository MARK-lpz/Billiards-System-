import { useEffect, useState } from "react";
import "../../styles/Admin/Audit.css";
import { MIN_PASSWORD_LENGTH, isPasswordTooShort } from "../../utils/passwordRules";
import { isValidSmsNumber, normalizeMobileNumber } from "../../utils/phone";
import { getUsernameError } from "../../utils/formValidation";
import AccountsManager from "../../Elements/Admin/AccountsManager";
import PasswordResetHistory from "../../Elements/Admin/PasswordResetHistory";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import { fetchPasswordResets } from "../../utils/passwordResetApi";
import { appendAuditLog } from "../../utils/audit";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { apiFetch } from "../../utils/apiFetch";
import { getSignedInUser } from "../../utils/session";

const emptyForm = { id: null, username: "", phone: "", password: "", role: "employee" };
const roleName = (role) => (role === "admin" ? "an admin" : "an employee");
const roleOf = (account) => String(account?.role || "").toLowerCase();

// What each change to an account says, in Accounts, the Audit Trail and the bell.
const STATUS_CHANGES = {
  archive: {
    action: (role) => `Archived ${role} account`,
    detail: (name) => `${name}'s account was archived. They were signed out and cannot sign in until it is restored.`,
    done: (name) => `${name} was archived and signed out.`,
  },
  restore: {
    action: (role) => `Restored ${role} account`,
    detail: (name) => `${name}'s account was restored. They can sign in again with their password.`,
    done: (name) => `${name} was restored and can sign in again.`,
  },
  delete: {
    action: (role) => `Deleted ${role} account`,
    detail: (name) => `${name}'s account was deleted. It had no sales, table bills or Audit Trail entries.`,
    done: (name) => `${name} was deleted.`,
  },
};

/**
 * Accounts: every staff account, admins and employees, in one list, and the
 * password resets. Only the admin changes passwords here (an employee can only
 * reset their own with a code). An account is archived rather than removed:
 * it is signed out and cannot sign in, and its name stays in the history. An
 * archived account with no records can then be deleted. A role is changed here
 * too, asked about first, and the account is signed out to sign in to its new
 * panel. Your own account is never archived and its role never changed here.
 * The server checks the same rules (api/users.php).
 */
export default function AccountManagement({ setLogs }) {
  const { addNotification } = useNotifications();
  const [accounts, setAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("adminManagedAccounts") || "[]");
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [passwordResets, setPasswordResets] = useState([]);
  const [resetMessage, setResetMessage] = useState("");
  // What waits for a yes: { action: "archive" | "delete", account }, or
  // { action: "role" } for the form's new role.
  const [confirming, setConfirming] = useState(null);
  const [selfId] = useState(() => String(getSignedInUser()?.id ?? ""));
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchPasswordResets()
      .then((resets) => {
        if (!cancelled) setPasswordResets(resets);
      })
      .catch(() => {
        if (!cancelled) setResetMessage("Password reset history is unavailable right now.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/users.php")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (!cancelled && Array.isArray(data.users)) {
          setAccounts(data.users);
          localStorage.setItem("adminManagedAccounts", JSON.stringify(data.users));
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Account API unavailable; showing local saved accounts.");
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
        ? previous.map((account) =>
            String(account.id) === String(savedAccount.id) ? { ...account, ...sanitizedAccount } : account
          )
        : [sanitizedAccount, ...previous];
    });
  };

  const persistAccount = async () => {
    const username = form.username.trim();
    const isUpdate = Boolean(form.id);
    const existingAccount = accounts.find((account) => String(account.id) === String(form.id));
    const role = form.role;
    const storedRole = roleOf(existingAccount);
    const roleChanged = isUpdate && storedRole !== role;

    if (!username || (!isUpdate && !form.password)) {
      setMessage("Username and password are required for a new account.");
      return false;
    }
    if (roleChanged && String(form.id) === selfId) {
      setMessage("You cannot change your own role. Another admin can.");
      return false;
    }
    if (form.phone && !isValidSmsNumber(form.phone)) {
      setMessage("Enter the mobile number in 09XXXXXXXXX format, or leave it blank.");
      return false;
    }
    // Checked when new or changed, so an older name can still have its password reset.
    const usernameError =
      existingAccount && existingAccount.username === username ? "" : getUsernameError(username, accounts, form.id);
    if (usernameError) {
      setMessage(usernameError);
      return false;
    }

    const payload = {
      id: form.id,
      username,
      password: form.password,
      role,
      // The form no longer edits email, so the stored one is sent back unchanged
      // rather than blanked.
      email: existingAccount?.email || "",
      fullName: existingAccount?.fullName || existingAccount?.full_name || "",
      phone: form.phone || "",
    };
    // Only an account the server saved is listed: one kept in this browser alone
    // could never sign in, since signing in checks the server.
    let savedAccount;
    try {
      const response = await apiFetch("/api/users.php", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        setMessage(data.message || "The account server refused the change. Nothing was saved.");
        return false;
      }

      savedAccount = data.user || { ...payload, id: form.id };
      setMessage(
        roleChanged
          ? `${username} is now ${roleName(role)}. They were signed out, to sign in to the ${role} panel.`
          : isUpdate
            ? `${username} was saved.`
            : `${username} was created as ${roleName(role)}.`
      );
    } catch {
      setMessage("Could not reach the account server, so nothing was saved. Check the connection and try again.");
      return false;
    }

    updateAccountList(savedAccount);
    // A new password signs the account out everywhere (the admin's own: but
    // here), so the log says so.
    const passwordChanged = isUpdate && Boolean(form.password);
    appendAuditLog(setLogs, {
      type: "auth",
      staff: "Admin",
      action: roleChanged
        ? "Changed account role"
        : passwordChanged
          ? `Changed ${role} password`
          : isUpdate
            ? `Updated ${role} credentials`
            : `Created ${role} account`,
      detail: roleChanged
        ? `${username} is now ${roleName(role)} (was ${roleName(storedRole)}). They were signed out, to sign in to the ${role} panel.${
            passwordChanged ? " Their password was changed too." : ""
          }`
        : passwordChanged
          ? `${username}'s password was changed in Accounts. ${
              role === "admin"
                ? "Any other device signed in with it has to sign in again."
                : "They were signed out on every device and sign in with the new password."
            }`
          : `${role} account ${username} was ${isUpdate ? "updated" : "created"}.`,
      entity: "user",
      entityId: String(savedAccount.id ?? ""),
    });
    addNotification({
      message: roleChanged
        ? `${username} is now ${roleName(role)}.`
        : `${username} ${passwordChanged ? "password changed" : isUpdate ? "credentials updated" : `${role} account created`}.`,
    });
    return true;
  };

  // A new admin, or a changed role, is asked about first: it decides what the account can open.
  const needsRoleConfirm = () => {
    if (!form.id) return form.role === "admin";
    const existing = accounts.find((account) => String(account.id) === String(form.id));
    return Boolean(existing) && roleOf(existing) !== form.role;
  };

  // Saves the form once nothing is left to ask; a saved form starts over.
  const finishSave = async () => {
    if (await persistAccount()) setForm(emptyForm);
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    // Stops here, before saving: a refused save would still be logged as updated.
    if (isPasswordTooShort(form.password)) {
      setMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (needsRoleConfirm()) {
      setConfirming({ action: "role" });
      return;
    }
    await finishSave();
  };

  const editAccount = (account) => {
    setForm({
      id: account.id,
      username: account.username || "",
      phone: normalizeMobileNumber(account.phone),
      password: "",
      role: roleOf(account) === "admin" ? "admin" : "employee",
    });
    setMessage("");
  };

  const askToChange = (action, account) => {
    setTypedName("");
    setConfirming({ action, account });
  };

  // Archive, restore or delete one account (see api/users.php).
  const changeStatus = async (action, account) => {
    const name = account.username;
    const change = STATUS_CHANGES[action];
    setBusy(true);
    try {
      const response = await apiFetch("/api/users.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: account.id, confirm: action === "delete" ? typedName : undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        setMessage(data.message || "The account server refused the change. Nothing was changed.");
        return;
      }

      if (action === "delete") {
        setAccounts((previous) => previous.filter((item) => String(item.id) !== String(account.id)));
      } else {
        updateAccountList(data.user || { ...account, archived: action === "archive" });
      }
      // The form never keeps editing an account that left the active list.
      if (action !== "restore" && String(form.id) === String(account.id)) setForm(emptyForm);
      setMessage(change.done(name));
      appendAuditLog(setLogs, {
        type: "auth",
        staff: "Admin",
        action: change.action(roleOf(account) === "admin" ? "admin" : "employee"),
        detail: change.detail(name),
        entity: "user",
        entityId: String(account.id),
      });
      addNotification({ message: change.done(name) });
    } catch {
      setMessage("Could not reach the account server, so nothing was changed. Check the connection and try again.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const formName = form.username.trim();

  return (
    <div className="audit-trail-container account-management-page">
      <div className="audit-trail-header">
        <h1 className="audit-trail-title">Account Management</h1>
        <p className="audit-trail-subtitle">Create, change and archive every staff account, admins and employees alike.</p>
      </div>

      <div className="account-management-sections">
        <AccountsManager
          accounts={accounts}
          form={form}
          message={message}
          selfId={selfId}
          onChange={(field, value) => setForm((previous) => ({ ...previous, [field]: value }))}
          onClear={() => {
            setForm(emptyForm);
            setMessage("");
          }}
          onEdit={editAccount}
          onSubmit={saveAccount}
          onArchive={(account) => askToChange("archive", account)}
          onRestore={(account) => changeStatus("restore", account)}
          onDelete={(account) => askToChange("delete", account)}
          busy={busy}
        />

        <PasswordResetHistory resets={passwordResets} message={resetMessage} />
      </div>

      {confirming?.action === "role" && (
        <ConfirmDialog
          icon={form.role === "admin" ? "bi-shield-lock" : "bi-person"}
          title={`Make ${formName} ${roleName(form.role)}?`}
          message={
            form.role === "admin" ? (
              <>
                <strong>{formName}</strong> will open everything in the admin panel: Accounts and every password,
                Sales Reports, Settings and the Audit Trail.
              </>
            ) : (
              <>
                <strong>{formName}</strong> will lose the admin panel and use the employee panel instead.
              </>
            )
          }
          detail={
            form.id
              ? `They are signed out now, to sign in again to the ${form.role} panel.`
              : "They sign in to the admin panel with this username and password."
          }
          confirmLabel={busy ? "Saving..." : form.role === "admin" ? "Yes, Make Admin" : "Yes, Make Employee"}
          cancelLabel="Go back"
          confirmDisabled={busy}
          onConfirm={async () => {
            setBusy(true);
            await finishSave();
            setBusy(false);
            setConfirming(null);
          }}
          onClose={() => !busy && setConfirming(null)}
        />
      )}

      {confirming?.action === "archive" && (
        <ConfirmDialog
          icon="bi-archive"
          title="Archive this account?"
          message={
            <>
              <strong>{confirming.account.username}</strong>
              {roleOf(confirming.account) === "admin" ? " (an admin)" : ""} will be signed out now and cannot sign
              in until you restore the account.
            </>
          }
          detail="Their sales and Audit Trail entries stay under their name. You can restore the account anytime from Archived."
          confirmLabel={busy ? "Archiving..." : "Yes, Archive"}
          cancelLabel="Keep Active"
          confirmDisabled={busy}
          onConfirm={() => changeStatus("archive", confirming.account)}
          onClose={() => !busy && setConfirming(null)}
        />
      )}

      {confirming?.action === "delete" && (
        <ConfirmDialog
          icon="bi-trash3"
          title="Delete this account for good?"
          message={
            <>
              <strong>{confirming.account.username}</strong> will be deleted. This cannot be undone.
            </>
          }
          detail="It has no sales, table bills or Audit Trail entries, so nothing in the history is lost."
          confirmLabel={busy ? "Deleting..." : "Yes, Delete"}
          cancelLabel="Keep Archived"
          confirmDisabled={busy || typedName !== confirming.account.username}
          onConfirm={() => changeStatus("delete", confirming.account)}
          onClose={() => !busy && setConfirming(null)}
        >
          <label className="form-label account-confirm-label" htmlFor="account-delete-name">
            Type <strong>{confirming.account.username}</strong> to confirm
          </label>
          <input
            id="account-delete-name"
            className="form-control"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
          />
        </ConfirmDialog>
      )}
    </div>
  );
}
