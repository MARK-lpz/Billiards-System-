import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import { useSiteSettings } from "../../Global/useSiteSettings";
import { DEFAULT_SITE_SETTINGS, FOOTER_TAGLINE_MAX_LENGTH } from "../../../utils/siteSettings";
import { formatOpeningHours } from "../../../utils/reservations";

/**
 * The line at the bottom of the home and Tournaments pages, beside the hall's
 * name (the home page adds the opening hours). It may be left empty.
 */
export default function FooterSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "footer",
    label: "footer",
    fieldLabels: { tagline: "footer line" },
    setLogs,
  });
  const { settings } = useSiteSettings();
  const tagline = draft.draft.tagline || "";
  const original = DEFAULT_SITE_SETTINGS.footer.tagline;

  return (
    <SiteCard
      icon="bi-layout-text-window-reverse"
      title="Footer"
      description="The short line at the bottom of the home and Tournaments pages."
      chip={draft.saved.tagline ? { tone: "on", label: "Shown" } : { tone: "off", label: "Empty" }}
      draft={draft}
      previewDark
      preview={
        <div className="website-footer-preview">
          <span className="website-footer-mark">
            Break &amp; Chill <small>Billiard Hall</small>
          </span>
          {tagline.trim() && <span>{tagline}</span>}
          <span>Open {formatOpeningHours(settings.hours)}</span>
        </div>
      }
    >
      <div className="website-fields">
        <label className="website-field">
          <span>
            Footer line <span className="website-optional">(optional)</span>
          </span>
          <input
            type="text"
            value={tagline}
            maxLength={FOOTER_TAGLINE_MAX_LENGTH}
            placeholder={`e.g. ${original}`}
            onChange={(event) => draft.update("tagline", event.target.value)}
          />
          <em>
            {tagline.length}/{FOOTER_TAGLINE_MAX_LENGTH} characters. Leave it empty to show only the name and the hours.
          </em>
        </label>

        {tagline !== original && (
          <div className="website-inline-actions">
            <button type="button" className="website-btn ghost" onClick={() => draft.update("tagline", original)}>
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
              Put back the original line
            </button>
          </div>
        )}
      </div>
    </SiteCard>
  );
}
