/**
 * The step bar of a step-by-step guest form (Table Reservation, Tournament
 * Registration). A step already done can be opened again from here; the ones
 * ahead open only through Next, which checks the current step first.
 */
export default function FormSteps({ steps, current, onGo, label }) {
  return (
    <ol className="form-steps" aria-label={label}>
      {steps.map((name, index) => {
        const state = index < current ? "is-done" : index === current ? "is-current" : "is-ahead";
        return (
          <li key={index} className={`form-step ${state}`} aria-current={index === current ? "step" : undefined}>
            <button type="button" className="form-step-btn" onClick={() => onGo(index)} disabled={index >= current}>
              <span className="form-step-dot" aria-hidden="true">
                {index < current ? <i className="bi bi-check-lg"></i> : index + 1}
              </span>
              <span className="form-step-name">{name}</span>
              {index < current && <span className="form-step-sr"> (done)</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** "Step 2 of 3", the step's name (focused when the step opens) and a line on what it is for. */
export function FormStepHead({ step, count, title, titleRef, note }) {
  return (
    <div className="form-step-head">
      <span className="form-step-count">
        Step {step + 1} of {count}
      </span>
      <h2 className="form-step-title" tabIndex={-1} ref={titleRef}>
        {title}
      </h2>
      {note && <p className="form-step-note">{note}</p>}
    </div>
  );
}

/**
 * What the guest filled in on the steps before, shown on the last step before
 * sending, two lines a row. Each row ({ icon, label, value, more: [parts],
 * onChange, changeLabel }) has a Change button back to its step; the label is
 * read out but not shown, the icon stands for it.
 */
export function FormReview({ title, rows }) {
  return (
    <section className="form-review" aria-label={title}>
      {rows.map((row) => {
        const more = (row.more || []).filter(Boolean);
        return (
          <div className="form-review-row" key={row.label}>
            <i className={`bi ${row.icon}`} aria-hidden="true"></i>
            <div className="form-review-text">
              <span className="form-step-sr">{row.label}: </span>
              <strong>{row.value}</strong>
              {more.length > 0 && <span className="form-review-more">{more.join(" · ")}</span>}
            </div>
            <button type="button" className="form-review-edit" onClick={row.onChange} aria-label={row.changeLabel}>
              Change
            </button>
          </div>
        );
      })}
    </section>
  );
}

/**
 * Back to the step before (named, so it is not mistaken for the page's own
 * Back button) and Next, or the form's own send button on the last step.
 * Next is a submit button, so Enter in a field moves on too; the form's submit
 * handler opens the next step instead of sending while it is not the last one.
 */
export function FormStepNav({ previous, onBack, nextReady, children }) {
  return (
    <div className={`form-step-nav${children ? " is-last" : ""}`}>
      {previous && (
        <button type="button" className="form-step-back" onClick={onBack} aria-label={`Back to ${previous}`}>
          <i className="bi bi-arrow-left" aria-hidden="true"></i>
          <span>{previous}</span>
        </button>
      )}
      {children || (
        <button type="submit" className="form-step-next" disabled={!nextReady}>
          Next
          <i className="bi bi-arrow-right" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
