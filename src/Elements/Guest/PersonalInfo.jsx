import { SKILL_LEVELS } from "../../utils/tournamentRegistrations";

// The player's details on step 1, and the skill level they play at (one of
// three, each with its rating), which the staff see beside their name.
export default function PersonalInfoForm({ form, onChange, contactWarning = "" }) {
  return (
    <>
      <div className="form-grid-2">
        <div>
          <label className="label" htmlFor="tourna-firstName">First Name</label>
          <input
            id="tourna-firstName"
            className="field-input"
            name="firstName"
            value={form.firstName}
            onChange={onChange}
            placeholder="Juan"
            autoComplete="given-name"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="tourna-lastName">Last Name</label>
          <input
            id="tourna-lastName"
            className="field-input"
            name="lastName"
            value={form.lastName}
            onChange={onChange}
            placeholder="dela Cruz"
            autoComplete="family-name"
            required
          />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="label" htmlFor="tourna-contact">Contact No.</label>
          <input
            id="tourna-contact"
            className="field-input"
            name="contact"
            value={form.contact}
            onChange={onChange}
            placeholder="09XX XXX XXXX"
            inputMode="numeric"
            autoComplete="tel"
            maxLength="11"
            required
          />
          {contactWarning && <p className="field-warning">{contactWarning}</p>}
        </div>
        <div>
          <label className="label" htmlFor="tourna-age">Age</label>
          <input
            id="tourna-age"
            className="field-input"
            type="number"
            name="age"
            value={form.age}
            onChange={onChange}
            placeholder="e.g. 22"
            min="10"
            max="80"
            required
          />
        </div>
      </div>
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
