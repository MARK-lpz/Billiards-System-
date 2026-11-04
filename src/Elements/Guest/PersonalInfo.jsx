import { SKILL_LEVELS } from "../../utils/tournamentRegistrations";
import OptionalEmailField from "./OptionalEmailField";

// The longest first or last name the form takes.
const MAX_NAME = 40;

// The player's details on step 1, and the skill level they play at (one of
// three, each with its rating), which the staff see beside their name.
// `errors`: { firstName, lastName, age, email }, each said under its own field.
export default function PersonalInfoForm({ form, onChange, contactWarning = "", errors = {} }) {
  // The field's own look and its message, tied together for screen readers.
  const invalid = (id, message) => ({
    className: `field-input ${message ? "is-invalid" : ""}`,
    "aria-invalid": Boolean(message),
    "aria-describedby": message ? `${id}-error` : undefined,
  });
  const warning = (id, message) =>
    message ? (
      <p className="field-warning" id={`${id}-error`} role="alert">
        {message}
      </p>
    ) : null;

  return (
    <>
      <div className="form-grid-2">
        <div>
          <label className="label" htmlFor="tourna-firstName">First Name</label>
          <input
            id="tourna-firstName"
            {...invalid("tourna-firstName", errors.firstName)}
            name="firstName"
            value={form.firstName}
            onChange={onChange}
            placeholder="Juan"
            autoComplete="given-name"
            maxLength={MAX_NAME}
            required
          />
          {warning("tourna-firstName", errors.firstName)}
        </div>
        <div>
          <label className="label" htmlFor="tourna-lastName">Last Name</label>
          <input
            id="tourna-lastName"
            {...invalid("tourna-lastName", errors.lastName)}
            name="lastName"
            value={form.lastName}
            onChange={onChange}
            placeholder="dela Cruz"
            autoComplete="family-name"
            maxLength={MAX_NAME}
            required
          />
          {warning("tourna-lastName", errors.lastName)}
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="label" htmlFor="tourna-contact">Contact No.</label>
          <input
            id="tourna-contact"
            {...invalid("tourna-contact", contactWarning)}
            name="contact"
            value={form.contact}
            onChange={onChange}
            placeholder="09XX XXX XXXX"
            inputMode="numeric"
            autoComplete="tel"
            maxLength="11"
            required
          />
          {warning("tourna-contact", contactWarning)}
        </div>
        <div>
          <label className="label" htmlFor="tourna-age">Age</label>
          <input
            id="tourna-age"
            {...invalid("tourna-age", errors.age)}
            type="number"
            inputMode="numeric"
            name="age"
            value={form.age}
            onChange={onChange}
            placeholder="e.g. 22"
            min="10"
            max="80"
            step="1"
            required
          />
          {warning("tourna-age", errors.age)}
        </div>
      </div>
      <OptionalEmailField id="tourna-email" value={form.email} onChange={onChange} warning={errors.email} />
      <fieldset className="skill-levels">
        <legend className="label">Skill Level</legend>
        <div className="skill-level-options">
          {SKILL_LEVELS.map((level) => (
            <label key={level.id} className={`skill-level-option ${form.skillLevel === level.id ? "is-chosen" : ""}`}>
              <input
                type="radio"
                name="skillLevel"
                value={level.id}
                checked={form.skillLevel === level.id}
                onChange={onChange}
                required
              />
              <span className="skill-level-name">{level.name}</span> <span className="skill-level-rating">{level.rating}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
