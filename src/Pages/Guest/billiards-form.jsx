import { useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import PersonalInfoForm from "../../Elements/Guest/PersonalInfo";
import TournamentDetailsForm from "../../Elements/Guest/TournaDetails";
import SuccessMessage from "../../Elements/Guest/SuccessMess";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { registerRemoteTournamentParticipant } from "../../utils/eventApi";
import GcashPayment from "../../Elements/Guest/GcashPayment";
import { validateReference } from "../../utils/paymentReference";
import { sendCustomerConfirmation } from "../../utils/customerMessageApi";
import { formatEventWhen, getEventNotices, getOpenEvents } from "../../utils/eventUpdates";
import { getAgeError, getPersonNameError } from "../../utils/formValidation";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import AnnouncementBar from "../../Elements/Guest/AnnouncementBar";

// Read when the form opens and on submit, never while rendering.
const getCurrentTimestamp = () => Date.now();

const isOpenForRegistration = (event) => ["upcoming", "active"].includes(String(event?.status || "").toLowerCase());

// "Juan Cruz (Team Cue)" and "juan cruz" are the same player.
const playerKey = (label) => String(label || "").replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();

export default function TournamentForm({ events = [], setEvents, onGoBack, initialEventId = null }) {
  const [form, setForm] = useState(() => ({
    firstName: "",
    lastName: "",
    contact: "",
    age: "",
    // Already chosen when the player pressed Register on a tournament.
    eventId: events.some((event) => String(event.id) === String(initialEventId) && isOpenForRegistration(event))
      ? String(initialEventId)
      : "",
    gameType: "",
    format: "",
    skillLevel: "",
    teamName: "",
    paymentReference: "",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // { text, status } from the server; status says whether it was really texted.
  const [customerMessage, setCustomerMessage] = useState(null);
  const [openedAt] = useState(getCurrentTimestamp);
  // A paid tournament is paid by GCash, so the website takes it only once the
  // admin has set the GCash account (Admin > Website).
  const gcashReady = useSiteSettings().settings.gcash.ready;
  // Players who come to register for a cancelled or moved tournament are told here.
  const notices = getEventNotices(events, openedAt);
  // Open ones only, and not past their day: a finished tournament takes no players.
  const availableEvents = getOpenEvents(events, openedAt);
  const selectedEvent = availableEvents.find((event) => String(event.id) === String(form.eventId)) || null;
  const contactIsValid = isValidSmsNumber(form.contact);
  const entryFee = Number(selectedEvent?.entryFee || 0);
  const paymentRequired = entryFee > 0;
  const paymentCheck = validateReference(form.paymentReference || "");
  const paymentSettled = !paymentRequired || (gcashReady && paymentCheck.isValid);
  const paymentUnavailable = paymentRequired && !gcashReady
    ? "Online payment is not set up yet. Please register at the hall."
    : "";
  const contactWarning = getSmsWarning(form.contact);
  const playerName = [form.firstName, form.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const alreadyRegistered =
    Boolean(selectedEvent && playerName) &&
    (selectedEvent.participants || []).some((participant) => playerKey(participant) === playerKey(playerName));
  // Each typed field is checked as soon as it has something in it.
  const fieldError =
    (form.firstName && getPersonNameError(form.firstName, "first name")) ||
    (form.lastName && getPersonNameError(form.lastName, "last name")) ||
    (form.age !== "" && getAgeError(form.age)) ||
    (form.teamName.trim().length > 40 && "Keep the team name to 40 characters or fewer.") ||
    (alreadyRegistered && `${playerName} is already registered for ${selectedEvent.name}.`) ||
    "";

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "contact" ? sanitizePhoneInput(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent || !contactIsValid || fieldError) return;

    if (paymentUnavailable) {
      setSubmitError(paymentUnavailable);
      return;
    }

    if (paymentRequired && !paymentCheck.isValid) {
      setSubmitError(
        paymentCheck.error || "Please pay the entry fee through GCash and enter the reference number."
      );
      return;
    }

    setSubmitError("");
    try {
      const playerLabel= form.teamName?.trim() ? `${playerName} (${form.teamName.trim()})` : playerName;
      const updatedEvent = await registerRemoteTournamentParticipant({
        eventId: selectedEvent.id,
        participant: playerLabel,
      });

      if (setEvents) {
        setEvents((prev) =>
          prev.map((event) =>
            event.id === selectedEvent.id
              ? updatedEvent
              : event
          )
        );
      }

      // The front desk's bell lists the new player from the saved tournament
      // (Tournament players), so nothing is kept in this guest's browser.

      // A failed text must never lose a paid registration, so this is best effort.
      try {
        setCustomerMessage(
          await sendCustomerConfirmation({
            context: "tournament",
            referenceId: String(selectedEvent.id),
            phone: form.contact,
            participant: playerLabel,
            paymentReference: paymentRequired ? paymentCheck.digits : "",
          })
        );
      } catch (messageError) {
        console.warn("Unable to send the player confirmation", messageError);
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error sending notification:', error);
      setSubmitError(error.message || "Unable to submit your registration. Please try again.");
    }
  };

  const handleReset = () => {
    setForm({
      firstName: "", lastName: "", contact: "",
      age: "", eventId: "", gameType: "", format: "", skillLevel: "",
      teamName: "", paymentReference: "",
    });
    setSubmitted(false);
    setCustomerMessage(null);
    setSubmitError("");
  };

  const requiredFields = ["firstName", "lastName", "contact", "age", "eventId", "gameType", "format", "skillLevel"];
  const isComplete =
    requiredFields.every((k) => String(form[k]).trim() !== "") && contactIsValid && paymentSettled && !fieldError;

  return (
    <div className="tournament-container">
      <button
        type="button"
        className="tournament-back-btn"
        onClick={onGoBack}
        title="Back to showcase"
      >
        <i className="bi bi-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </button>
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
          {!submitted && <AnnouncementBar className="is-in-card" />}

          {notices.length > 0 && !submitted && (
            <div className="tourna-notices" role="status">
              {notices.map(({ event, type }) => (
                <div key={event.id} className={`tourna-notice is-${type}`}>
                  <i className={`bi ${type === "cancelled" ? "bi-x-octagon-fill" : "bi-calendar2-week-fill"}`} aria-hidden="true"></i>
                  <span>
                    <strong>
                      {event.name} {type === "cancelled" ? "is cancelled." : "is rescheduled."}
                    </strong>{" "}
                    {type === "cancelled"
                      ? `It was set for ${formatEventWhen(event.date, event.time)}.`
                      : `New schedule: ${formatEventWhen(event.date, event.time)} (was ${formatEventWhen(event.rescheduledFrom.date, event.rescheduledFrom.time)}).`}
                    {type === "cancelled" && event.cancelReason ? ` Reason: ${event.cancelReason}` : ""}
                    {type === "rescheduled" && event.rescheduleReason ? ` Reason: ${event.rescheduleReason}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {availableEvents.length === 0 ? (
            <div className="no-active-events fade-in" role="status">
              <div className="no-active-events-icon">
                <i className="bi bi-calendar-x" aria-hidden="true"></i>
              </div>
              <h2>No Active Tournaments</h2>
              <p>There are no tournaments open for registration right now. Please check back after Break &amp; Chill posts a new event.</p>
            </div>
          ) : !submitted ? (
            <form onSubmit={handleSubmit} className="fade-in">
              <PersonalInfoForm form={form} onChange={handleChange} contactWarning={contactWarning} />
              <TournamentDetailsForm
                form={form}
                onChange={handleChange}
                events={availableEvents}
                selectedEvent={selectedEvent}
              />

              {paymentRequired && (
                <GcashPayment
                  title="Pay the entry fee with GCash"
                  total={entryFee}
                  lines={[
                    { label: "Tournament", value: selectedEvent.name },
                    { label: "Entry fee", value: `PHP ${entryFee.toLocaleString("en-PH")}` },
                  ]}
                  reference={form.paymentReference}
                  onReferenceChange={(value) =>
                    setForm((previous) => ({ ...previous, paymentReference: value }))
                  }
                />
              )}

              <div style={{ marginBottom: 28 }} />

              <button type="submit" className="submit-btn" disabled={!isComplete}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: 8 }}></i>
                Register for Tournament
              </button>
              {!isComplete && (
                <p className="required-text">
                  <i className="bi bi-info-circle" style={{ marginRight: 6 }}></i>
                  {fieldError || contactWarning || paymentUnavailable || "Please fill in all required fields"}
                </p>
              )}
              {submitError && <p className="required-text">{submitError}</p>}
            </form>
          ) : (
            <>
              <SuccessMessage form={form} onReset={handleReset} />
              {customerMessage && (
                <div className="customer-message-card">
                  <div className="customer-message-head">
                    <i className="bi bi-chat-left-text-fill" aria-hidden="true"></i>
                    <strong>
                      {customerMessage.status === "sent" ? `Texted to ${form.contact}` : "Your confirmation"}
                    </strong>
                  </div>
                  <p className="customer-message-body">{customerMessage.text}</p>
                  <p className="customer-message-note">Keep this for your records.</p>
                </div>
              )}
            </>
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
