import { useState } from "react";
import "../styles/Settings.css";
import ConfirmDialog from "../Elements/Global/ConfirmDialog";
import {
  applyBrowserData,
  backupFileName,
  buildBackupFile,
  collectBrowserData,
  parseBackupFile,
} from "../utils/backup";
import { exportServerBackup, restoreServerBackup } from "../utils/backupApi";
import { getSignedInUser } from "../utils/session";

const THEME_OPTIONS = [
  {
    value: "dark",
    label: "Dark Mode",
    description: "Easy on the eyes in a dim hall and at night.",
    icon: "bi-moon-stars-fill",
  },
  {
    value: "light",
    label: "Light Mode",
    description: "Brighter screens for daytime and well-lit counters.",
    icon: "bi-sun-fill",
  },
];

const readSignedInUser = getSignedInUser;

const downloadJson = (data, fileName) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatStamp = (iso) => {
  if (!iso) return "Unknown date";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

export default function Settings({ theme, setTheme, canManageBackups = false, showHeader = true, onRestored }) {
  const [signedInUser] = useState(readSignedInUser);
  const username = signedInUser?.username || "";

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const credentials = { username, password };

  // Server tables and this browser's records, gathered into one file.
  const buildCurrentBackup = async (creds) => {
    const server = await exportServerBackup(creds);
    const browser = collectBrowserData(localStorage);
    return buildBackupFile({ server, browser, createdBy: creds.username });
  };

  const handleDownload = async (creds) => {
    setNotice(null);
    setBusy("backup");
    try {
      const backup = await buildCurrentBackup(creds);
      downloadJson(backup, backupFileName());
      setNotice({ tone: "success", text: "Backup downloaded. Keep it somewhere safe, away from this computer." });
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleFileChosen = async (file) => {
    setNotice(null);
    setRestoreCandidate(null);
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      setNotice({ tone: "error", text: "That file could not be opened. Choose the backup file again." });
      return;
    }

    const parsed = parseBackupFile(text);
    if (!parsed.ok) {
      setNotice({ tone: "error", text: parsed.error });
      return;
    }

    setRestoreCandidate({ fileName: file.name, backup: parsed.backup, summary: parsed.summary });
  };

  const clearCandidate = () => {
    setRestoreCandidate(null);
    setFileInputKey((key) => key + 1);
  };

  const runRestore = async (candidate, creds) => {
    setConfirmOpen(false);
    setNotice(null);
    setBusy("restore");

    try {
      // An undo file first: if the wrong backup was picked, this puts it back.
      const current = await buildCurrentBackup(creds);
      downloadJson(current, backupFileName(new Date(), "before-restore"));

      await restoreServerBackup({ ...creds, server: candidate.backup.server });
      applyBrowserData(localStorage, candidate.backup.browser);
      if (onRestored) onRestored();

      clearCandidate();
      setPassword("");
      setNotice({
        tone: "success",
        text: "Restore complete. A copy of the data from just before the restore was downloaded, in case you need to undo it.",
      });
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="settings-page">
      {showHeader && (
        <div className="settings-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Choose how the system looks and keep a safe copy of your data.</p>
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card-head">
          <i className="bi bi-palette-fill" aria-hidden="true"></i>
          <div>
            <h2>Color Preference</h2>
            <p>Saved on this device and applied right away.</p>
          </div>
        </div>

        <div className="settings-theme-grid" role="radiogroup" aria-label="Color preference">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`settings-theme-option${selected ? " selected" : ""}`}
                onClick={() => setTheme(option.value)}
              >
                <span className={`settings-theme-preview preview-${option.value}`} aria-hidden="true">
                  <span className="preview-sidebar"></span>
                  <span className="preview-body">
                    <span className="preview-line"></span>
                    <span className="preview-line short"></span>
                  </span>
                </span>
                <span className="settings-theme-text">
                  <strong>
                    <i className={`bi ${option.icon}`} aria-hidden="true"></i>
                    {option.label}
                  </strong>
                  <span>{option.description}</span>
                </span>
                {selected && <i className="bi bi-check-circle-fill settings-theme-check" aria-hidden="true"></i>}
              </button>
            );
          })}
        </div>
      </section>

      {canManageBackups && (
        <section className="settings-card">
          <div className="settings-card-head">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
            <div>
              <h2>Backup &amp; Restore</h2>
              <p>One file with every record in the system, for when data goes missing.</p>
            </div>
          </div>

          <div className="settings-backup-note">
            <i className="bi bi-info-circle" aria-hidden="true"></i>
            <span>
              Inventory, sales, equipment, customers and the audit log are stored in this browser only. Take backups
              from the computer where that work is done. Staff accounts and passwords are never included.
            </span>
          </div>

          <label className="settings-field">
            <span>Admin password {username && <em>for {username}</em>}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Needed to back up or restore"
              autoComplete="current-password"
              disabled={Boolean(busy)}
            />
          </label>

          {!username && (
            <p className="settings-message error">Sign out and sign in again so the system knows which admin you are.</p>
          )}

          <div className="settings-backup-grid">
            <div className="settings-backup-block">
              <h3>
                <i className="bi bi-download" aria-hidden="true"></i>
                Back up now
              </h3>
              <p>Downloads a file of today&apos;s data. Do this at closing time, every day.</p>
              <button
                type="button"
                className="settings-btn primary"
                onClick={() => handleDownload(credentials)}
                disabled={!username || !password || Boolean(busy)}
              >
                {busy === "backup" ? "Preparing backup..." : "Download Backup"}
              </button>
            </div>

            <div className="settings-backup-block">
              <h3>
                <i className="bi bi-upload" aria-hidden="true"></i>
                Restore from a backup
              </h3>
              <p>Replaces the current data with the data in the file you choose.</p>
              <input
                key={fileInputKey}
                type="file"
                accept=".json,application/json"
                className="settings-file"
                onChange={(event) => handleFileChosen(event.target.files?.[0])}
                disabled={Boolean(busy)}
              />
            </div>
          </div>

          {restoreCandidate && (
            <div className="settings-restore-preview">
              <div className="settings-restore-head">
                <div>
                  <strong>{restoreCandidate.fileName}</strong>
                  <span>
                    Made {formatStamp(restoreCandidate.summary.createdAt)}
                    {restoreCandidate.summary.createdBy ? ` by ${restoreCandidate.summary.createdBy}` : ""}
                  </span>
                </div>
                <button type="button" className="settings-link" onClick={clearCandidate} disabled={Boolean(busy)}>
                  Choose another file
                </button>
              </div>

              <div className="settings-restore-columns">
                {[
                  ["Shared data", restoreCandidate.summary.server],
                  ["This device", restoreCandidate.summary.browser],
                ].map(([heading, rows]) => (
                  <div key={heading}>
                    <h4>{heading}</h4>
                    <ul>
                      {rows.map((row) => (
                        <li key={row.key} className={row.present ? "" : "missing"}>
                          <span>{row.label}</span>
                          <b>{row.present ? row.count : "not in file"}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="settings-btn danger"
                onClick={() => setConfirmOpen(true)}
                disabled={!username || !password || Boolean(busy)}
              >
                {busy === "restore" ? "Restoring..." : "Restore This Backup"}
              </button>
              {!password && <p className="settings-message">Enter your admin password above to restore.</p>}
            </div>
          )}

          {notice && <p className={`settings-message ${notice.tone}`}>{notice.text}</p>}
        </section>
      )}

      {confirmOpen && restoreCandidate && (
        <ConfirmDialog
          title="Replace all current data?"
          message={
            <>
              Everything in the system will be replaced with the backup from{" "}
              <strong>{formatStamp(restoreCandidate.summary.createdAt)}</strong>. Records added after that time will be
              removed.
            </>
          }
          detail="A copy of the current data downloads first, so you can undo this by restoring that file."
          confirmLabel="Yes, Restore Backup"
          cancelLabel="Keep Current Data"
          onConfirm={() => runRestore(restoreCandidate, credentials)}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
