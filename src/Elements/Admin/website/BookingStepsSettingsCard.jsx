import SiteCard from "./SiteCard";
import useSiteSectionDraft from "./useSiteSectionDraft";
import {
  DEFAULT_SITE_SETTINGS,
  STEPS_HEADING_MAX_LENGTH,
  STEP_TEXT_MAX_LENGTH,
  STEP_TITLE_MAX_LENGTH,
} from "../../../utils/siteSettings";

const same = (first, second) => JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
const oneLine = (text) => text.replace(/\s*\n\s*/g, " ");

// For the Audit Trail: "heading changed; step 2 text changed".
const describeSteps = (saved, draft) => {
  const phrases = [];
  if (saved.heading !== draft.heading) phrases.push("heading changed");
  (draft.steps || []).forEach((step, index) => {
    const old = saved.steps?.[index] || {};
    const fields = ["title", "text"].filter((field) => !same(old[field], step[field]));
    if (fields.length) phrases.push(`step ${index + 1} ${fields.join(" and ")} changed`);
  });
  return phrases;
};

/**
 * "Your table in three shots": how an online booking goes, on the home page
 * under the showcase. Always three steps, since each sits on a numbered ball
 * (1 yellow, 2 blue, 3 red); the admin words the heading and each step.
 */
export default function BookingStepsSettingsCard({ setLogs }) {
  const draft = useSiteSectionDraft({
    section: "bookingSteps",
    label: "booking steps",
    fieldLabels: { heading: "heading", steps: "steps" },
    describe: describeSteps,
    setLogs,
  });
  const heading = draft.draft.heading || "";
  const steps = draft.draft.steps || [];
  const empty = !heading.trim() ? "the heading" : steps.some((step) => !step.title.trim() || !step.text.trim()) ? "every step" : "";
  const isDefault = same(draft.saved, DEFAULT_SITE_SETTINGS.bookingSteps);

  const updateStep = (index, values) =>
    draft.update("steps", (current = []) => current.map((step, at) => (at === index ? { ...step, ...values } : step)));

  return (
    <SiteCard
      icon="bi-list-ol"
      title="Booking steps"
      description="How an online booking goes, under the slides on the home page. Always three steps, one on each numbered ball."
      chip={isDefault ? { tone: "off", label: "Original words" } : { tone: "on", label: "Own words" }}
      draft={draft}
      blocked={empty ? `Fill in ${empty} to save.` : ""}
      previewDark
      preview={
        <div className="website-steps-preview">
          <span className="website-steps-preview-eyebrow">Book online</span>
          <strong className="website-steps-preview-heading">{heading.trim() || "(heading)"}</strong>
          <ol>
            {steps.map((step, index) => (
              <li key={index}>
                <span className={`website-ball is-${index + 1}`} aria-hidden="true">
                  <span>{index + 1}</span>
                </span>
                <div>
                  <strong>{step.title.trim() || "(title)"}</strong>
                  <p>{step.text.trim() || "(text)"}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      }
    >
      <div className="website-fields">
        <label className="website-field">
          Heading
          <input
            type="text"
            value={heading}
            maxLength={STEPS_HEADING_MAX_LENGTH}
            placeholder="e.g. Your table in three shots."
            aria-invalid={!heading.trim()}
            onChange={(event) => draft.update("heading", event.target.value)}
          />
          {!heading.trim() ? <em className="error">A heading is needed.</em> : <em>Above the three steps.</em>}
        </label>

        <ol className="website-steps">
          {steps.map((step, index) => (
            <li key={index} className="website-step">
              <span className={`website-ball is-${index + 1}`} aria-hidden="true">
                <span>{index + 1}</span>
              </span>
              <div className="website-fields">
                <label className="website-field">
                  Step {index + 1} title
                  <input
                    type="text"
                    value={step.title}
                    maxLength={STEP_TITLE_MAX_LENGTH}
                    aria-invalid={!step.title.trim()}
                    onChange={(event) => updateStep(index, { title: event.target.value })}
                  />
                  {!step.title.trim() && <em className="error">A title is needed.</em>}
                </label>
                <label className="website-field">
                  Step {index + 1} text
                  <textarea
                    rows={3}
                    value={step.text}
                    maxLength={STEP_TEXT_MAX_LENGTH}
                    aria-invalid={!step.text.trim()}
                    onChange={(event) => updateStep(index, { text: oneLine(event.target.value) })}
                  />
                  {!step.text.trim() ? (
                    <em className="error">A text is needed.</em>
                  ) : (
                    <em>
                      {step.text.length}/{STEP_TEXT_MAX_LENGTH} characters
                    </em>
                  )}
                </label>
              </div>
            </li>
          ))}
        </ol>

        {!isDefault && (
          <div className="website-inline-actions">
            <button
              type="button"
              className="website-btn ghost"
              onClick={() => {
                draft.update("heading", DEFAULT_SITE_SETTINGS.bookingSteps.heading);
                draft.update("steps", DEFAULT_SITE_SETTINGS.bookingSteps.steps);
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
