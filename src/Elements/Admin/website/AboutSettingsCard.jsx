import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import {
  ABOUT_HEADING_MAX_LENGTH,
  ABOUT_PARAGRAPHS_MAX,
  ABOUT_TEXT_MAX_LENGTH,
  DEFAULT_SITE_SETTINGS,
  aboutParagraphs,
} from "../../../utils/siteSettings";
import { readTextField } from "../../../utils/textField";

/**
 * About us on the home page: a heading and a few short paragraphs about the
 * hall, shown beside its address, opening hours and contacts (the two cards
 * under this one, in the same tab).
 */
export default function AboutSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "about",
    label: "About us",
    fieldLabels: { heading: "heading", text: "words" },
    setLogs,
  });
  const heading = draft.draft.heading || "";
  const text = draft.draft.text || "";
  const paragraphs = aboutParagraphs(text);
  const savedParagraphs = aboutParagraphs(draft.saved.text).length;
  const original = DEFAULT_SITE_SETTINGS.about;
  const isOriginal = heading === original.heading && text === original.text;
  const blocked = !heading.trim()
    ? "Write the heading first."
    : !paragraphs.length
      ? "Write a few lines about the hall first."
      : paragraphs.length > ABOUT_PARAGRAPHS_MAX
        ? `Keep it to ${ABOUT_PARAGRAPHS_MAX} paragraphs.`
        : "";

  return (
    <SiteCard
      icon="bi-info-circle"
      title="About us"
      description="Who you are and what the hall is like, shown on the home page beside the address and the opening hours."
      chip={{ tone: "on", label: `${savedParagraphs} paragraph${savedParagraphs === 1 ? "" : "s"}` }}
      draft={draft}
      blocked={blocked}
      previewDark
      preview={
        <div className="website-about-preview">
          <span className="website-about-preview-eyebrow">About us</span>
          <strong className="website-about-preview-heading">{heading.trim() || "Heading"}</strong>
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <p className="website-preview-empty">A few lines about the hall show here.</p>
          )}
        </div>
      }
    >
      <div className="website-fields">
        <label className="website-field">
          Heading
          <input
            type="text"
            value={heading}
            maxLength={ABOUT_HEADING_MAX_LENGTH}
            placeholder={`e.g. ${original.heading}`}
            onChange={(event) => draft.update("heading", readTextField(event))}
          />
          <em>
            {heading.length}/{ABOUT_HEADING_MAX_LENGTH} characters
          </em>
        </label>

        <label className="website-field">
          About the hall
          <textarea
            rows={7}
            value={text}
            maxLength={ABOUT_TEXT_MAX_LENGTH}
            placeholder="What the hall is like, who it is for, what makes it worth the visit."
            onChange={(event) => draft.update("text", readTextField(event))}
          />
          <em>
            {text.length}/{ABOUT_TEXT_MAX_LENGTH} characters. Leave an empty line between paragraphs (up to {ABOUT_PARAGRAPHS_MAX}).
          </em>
        </label>

        {!isOriginal && (
          <div className="website-inline-actions">
            <button
              type="button"
              className="website-btn ghost"
              onClick={() => {
                draft.update("heading", original.heading);
                draft.update("text", original.text);
              }}
            >
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
              Put back the original words
            </button>
          </div>
        )}
      </div>
    </SiteCard>
  );
}
