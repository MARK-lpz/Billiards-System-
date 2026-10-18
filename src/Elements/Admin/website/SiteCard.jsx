const formatSavedAt = (ms) =>
  new Date(ms).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One card of Admin > Website: what it sets, a status chip, its fields, and its
 * own Save. `draft` is what useSiteSectionDraft returns.
 */
export default function SiteCard({ icon, title, description, chip, draft, children }) {
  return (
    <section className="website-card" aria-labelledby={`website-${title}`}>
      <div className="website-card-head">
        <i className={`bi ${icon}`} aria-hidden="true"></i>
        <div>
          <h2 id={`website-${title}`}>{title}</h2>
          <p>{description}</p>
        </div>
        {chip && <span className={`website-chip is-${chip.tone}`}>{chip.label}</span>}
      </div>

      {children}

      <div className="website-card-foot">
        <button type="button" className="website-btn primary" onClick={draft.save} disabled={!draft.dirty || draft.saving}>
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
            (draft.dirty ? "Not saved yet." : draft.savedAt ? `Last saved ${formatSavedAt(draft.savedAt)}` : "Never saved.")}
        </span>
      </div>
    </section>
  );
}
