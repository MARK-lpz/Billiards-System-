import { useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import PersonalInfoForm from "../../Elements/Guest/PersonalInfo";
import TournamentDetailsForm from "../../Elements/Guest/TournaDetails";
import SuccessMessage from "../../Elements/Guest/SuccessMess";

export default function TournamentForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    age: "",
    gameType: "",
    format: "",
    skillLevel: "",
    teamName: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Create notification for admin
      const notification = {
        id: Date.now(),
        message: `New tournament registration: ${form.firstName} ${form.lastName}`,
        time: "Just now",
        unread: true,
        type: "tournament",
        data: form
      };

      // Store in localStorage (temporary solution until backend is ready)
      const existingNotifications = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
      existingNotifications.unshift(notification);
      localStorage.setItem('adminNotifications', JSON.stringify(existingNotifications));

      // TODO: Replace with actual API call when backend is ready
      // await fetch('YOUR_API_ENDPOINT/tournament-registrations', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(form)
      // });

      setSubmitted(true);
    } catch (error) {
      console.error('Error sending notification:', error);
      // Still show success to user even if notification fails
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setForm({
      firstName: "", lastName: "", contact: "", email: "",
      age: "", gameType: "", format: "", skillLevel: "",
      teamName: "",
    });
    setSubmitted(false);
  };

  const requiredFields = ["firstName", "lastName", "contact", "email", "age", "gameType", "format", "skillLevel"];
  const isComplete = requiredFields.every((k) => form[k] !== "");

  return (
    <div className="tournament-container">
      <div className="tournament-wrapper">
        {/* Header */}
        <div className="tournament-header fade-in">
          <div style={{ marginBottom: 10 }}>
            <i className="bi bi-trophy-fill trophy-icon"></i>
          </div>
          <div className="tournament-header-lines">
            <div className="header-line-left" />
            <span className="header-est">Est. 2026</span>
            <div className="header-line-right" />
          </div>
          <h1 className="tournament-title">BREAK & CHILL</h1>
          <p className="tournament-subtitle">Tournament Registration Form</p>
        </div>

        {/* Card */}
        <div className="tournament-card">
          <div className="card-top-line" />

          {!submitted ? (
            <form onSubmit={handleSubmit} className="fade-in">
              <PersonalInfoForm form={form} onChange={handleChange} />
              <TournamentDetailsForm form={form} onChange={handleChange} />

              <div style={{ marginBottom: 28 }} />

              <button type="submit" className="submit-btn" disabled={!isComplete}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: 8 }}></i>
                Register for Tournament
              </button>
              {!isComplete && (
                <p className="required-text">
                  <i className="bi bi-info-circle" style={{ marginRight: 6 }}></i>
                  Please fill in all required fields
                </p>
              )}
            </form>
          ) : (
            <SuccessMessage form={form} onReset={handleReset} />
          )}
        </div>

        {/* Footer */}
        <p className="tournament-footer">
          2026 Break & Chill Billiards
        </p>
      </div>
    </div>
  );
}