import { useContext, useEffect } from "react";
import { WebsiteTabsContext } from "./WebsiteTabsContext";

const formatSavedAt = (ms) =>
  new Date(ms).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// "Last saved Oct 19, 2026, 3:00 PM by juan (employee)"; who saved it, when the server says.
const describeSaved = ({ savedAt, savedBy }) => {
  const by = savedBy?.name ? ` by ${savedBy.name}${savedBy.role === "employee" ? " (employee)" : ""}` : "";
  return `Last saved ${formatSavedAt(savedAt)}${by}`;
};

/**
 * One card of Admin > Website, laid out the same for every section: what it
 * sets and a status chip, then the fields on the left and what customers see
 * on the right (`preview`; below the fields on a narrow screen), then its own
 * Save. `draft` is what useSiteSectionDraft returns. `blocked` says what to fix
 * before the changes can be saved (Save stays off; Undo stays on).
 */
export default function SiteCard({ icon, title, description, chip, draft, blocked = "", preview, previewDark = false, children }) {
  // An id has no spaces ("Opening hours" -> "website-opening-hours"), or aria-labelledby reads it as two ids.
  const headingId = `website-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const reportDirty = useContext(WebsiteTabsContext);

  useEffect(() => {
    reportDirty?.(draft.section, draft.dirty);
  }, [reportDirty, draft.section, draft.dirty]);

  return (
    <section className="website-card" aria-labelledby={headingId}>
      <div className="website-card-head">
        <i className={`bi ${icon}`} aria-hidden="true"></i>
        <div>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
        {chip && <span className={`website-chip is-${chip.tone}`}>{chip.label}</span>}
      </div>

      <div className={`website-card-body ${preview ? "has-preview" : ""}`}>
        <div className="website-card-main">{children}</div>
        {preview && (
          <aside className={`website-card-preview ${previewDark ? "is-dark" : ""}`} aria-label="What customers see">
            <span className="website-preview-label">Customers see</span>
            {preview}
          </aside>
        )}
      </div>

      <div className="website-card-foot">
        <button type="button" className="website-btn primary" onClick={draft.save} disabled={!draft.dirty || draft.saving || Boolean(blocked)}>
          <i className="bi bi-check2-circle" aria-hidden="true"></i>
          {draft.saving ? "Saving..." : "Save"}
        </button>
        {draft.dirty && !draft.saving && (
          <button type="button" className="website-btn ghost" onClick={draft.reset}>
            Undo changes
          </button>
        )}
        <span className={`website-status ${draft.status?.tone || ""}`} role="status">
          {draft.status?.text ||
            (draft.dirty ? blocked || "Not saved yet." : draft.savedAt ? describeSaved(draft) : "Never saved.")}
        </span>
      </div>
    </section>
  );
}
