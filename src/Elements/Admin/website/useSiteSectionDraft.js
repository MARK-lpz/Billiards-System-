import { useState } from "react";
import { useSiteSettings } from "../../Global/useSiteSettings";
import { saveSiteSection } from "../../../utils/siteSettingsApi";
import { appendAuditLog } from "../../../utils/audit";

const pick = (values, fields) => Object.fromEntries(fields.map((field) => [field, values?.[field] ?? null]));
const same = (first, second) => JSON.stringify(first ?? null) === JSON.stringify(second ?? null);

/**
 * One card of Admin > Website: its own copy of a section to edit, saved on its
 * own so the other cards are never touched. `fieldLabels` names each field for
 * the Audit Trail ("GCash: account name, QR picture changed."). The server
 * checks and cleans what is saved; the copy takes its answer.
 */
export default function useSiteSectionDraft({ section, label, fieldLabels, setLogs }) {
  const { settings, savedAt, applySaved } = useSiteSettings();
  const fields = Object.keys(fieldLabels);
  const saved = settings[section];
  const [draft, setDraft] = useState(() => pick(saved, fields));
  const [saving, setSaving] = useState(false);
  // { tone: "success" | "error", text }
  const [status, setStatus] = useState(null);
  const changed = fields.filter((field) => !same(draft[field], saved[field]));

  const update = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setStatus(null);
  };

  const save = async () => {
    if (!changed.length || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const answer = await saveSiteSection(section, draft);
      applySaved(answer);
      setDraft(pick(answer.settings[section], fields));
      appendAuditLog(setLogs, {
        type: "settings",
        staff: "Admin",
        action: "Updated website",
        detail: `Website ${label}: ${changed.map((field) => fieldLabels[field]).join(", ")} changed.`,
        entity: "website",
      });
      setStatus({ tone: "success", text: "Saved." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(pick(saved, fields));
    setStatus(null);
  };

  return { saved, draft, update, save, reset, saving, status, dirty: changed.length > 0, savedAt: savedAt[section] || 0 };
}
