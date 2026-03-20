export default function PersonalInfoForm({ form, onChange }) {
  return (
    <>
      <p className="section-title">Personal Information</p>
      <div className="form-grid-2">
        <div>
          <label className="label">First Name</label>
          <input 
            className="field-input" 
            name="firstName" 
            value={form.firstName}
            onChange={onChange} 
            placeholder="Juan" 
            required 
          />
        </div>
        <div>
          <label className="label">Last Name</label>
          <input 
            className="field-input" 
            name="lastName" 
            value={form.lastName}
            onChange={onChange} 
            placeholder="dela Cruz" 
            required 
          />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="label">Contact No.</label>
          <input 
            className="field-input" 
            name="contact" 
            value={form.contact}
            onChange={onChange} 
            placeholder="09XX XXX XXXX" 
            required 
          />
        </div>
        <div>
          <label className="label">Age</label>
          <input 
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
      <div className="form-field-full">
        <label className="label">Email Address</label>
        <input 
          className="field-input" 
          type="email" 
          name="email" 
          value={form.email}
          onChange={onChange} 
          placeholder="juandelacruz@email.com" 
          required 
        />
      </div>
    </>
  );
}