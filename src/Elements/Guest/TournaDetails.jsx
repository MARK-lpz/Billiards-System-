const GAME_TYPES = ["8-Ball", "9-Ball", "Straight Pool", "Snooker", "Rotation"];
const FORMATS = ["Single Elimination", "Double Elimination", "Round Robin", "Swiss System"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Open (All Levels)"];

const fmtDate = (value) => {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
};

const fmtTime = (value) => {
  if (!value) return "Time not set";
  const parsed = new Date(`2000-01-01T${value}`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
};

export default function TournamentDetailsForm({ form, onChange, events = [], selectedEvent }) {
  return (
    <>
      <p className="section-title">Tournament Details</p>
      <div className="form-field-full">
        <label className="label">Tournament Event</label>
        <select
          className="field-input"
          name="eventId"
          value={form.eventId}
          onChange={onChange}
          required
        >
          <option value="">Select Tournament</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        {selectedEvent && (
          <div className="field-helper">
            {fmtDate(selectedEvent.date)} • {fmtTime(selectedEvent.time)}
          </div>
        )}
      </div>
      <div className="form-grid-2">
        <div>
          <label className="label">Game Type</label>
          <select 
            className="field-input" 
            name="gameType" 
            value={form.gameType} 
            onChange={onChange} 
            required
          >
            <option value="">Select Game</option>
            {GAME_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tournament Format</label>
          <select 
            className="field-input" 
            name="format" 
            value={form.format} 
            onChange={onChange} 
            required
          >
            <option value="">Select Format</option>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid-2" style={{ marginBottom: 24 }}>
        <div>
          <label className="label">Skill Level</label>
          <select 
            className="field-input" 
            name="skillLevel" 
            value={form.skillLevel} 
            onChange={onChange} 
            required
          >
            <option value="">Select Level</option>
            {SKILL_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Team / Nickname</label>
          <input 
            className="field-input" 
            name="teamName" 
            value={form.teamName}
            onChange={onChange} 
            placeholder="Optional" 
          />
        </div>
      </div>
    </>
  );
}
