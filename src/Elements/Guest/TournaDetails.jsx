const GAME_TYPES = ["8-Ball", "9-Ball", "Straight Pool", "Snooker", "Rotation"];
const FORMATS = ["Single Elimination", "Double Elimination", "Round Robin", "Swiss System"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Open (All Levels)"];

export default function TournamentDetailsForm({ form, onChange }) {
  return (
    <>
      <p className="section-title">Tournament Details</p>
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