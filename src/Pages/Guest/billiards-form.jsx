import { useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import PersonalInfoForm from "../../Elements/Guest/PersonalInfo";
import TournamentDetailsForm from "../../Elements/Guest/TournaDetails";
import SuccessMessage from "../../Elements/Guest/SuccessMess";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { registerWebsiteTournamentParticipant } from "../../utils/eventApi";
import GcashPayment from "../../Elements/Guest/GcashPayment";
import { validateReference } from "../../utils/paymentReference";
import { sendCustomerConfirmation } from "../../utils/customerMessageApi";
import { formatEventWhen, gameTypeLabel, getEventNotices, getOpenEvents } from "../../utils/eventUpdates";
import { getAgeError, getPersonNameError } from "../../utils/formValidation";
import { useSiteSettings } from "../../Elements/Global/useSiteSettings";
import AnnouncementBar from "../../Elements/Guest/AnnouncementBar";
import { useMyRequests } from "../../Elements/Guest/useMyRequests";
import RequestStatusCard from "../../Elements/Guest/RequestStatusCard";
import { describeJustSent } from "../../utils/myRequests";
import { formatMobile } from "../../utils/siteSettings";
import FormSteps, { FormReview, FormStepHead, FormStepNav } from "../../Elements/Guest/FormSteps";
import { useFormSteps } from "../../Elements/Guest/useFormSteps";
import { buildParticipantLabel, skillLevelLabel } from "../../utils/tournamentRegistrations";

// What the player is told about the entry fee before and after sending.
const HELD_NOTE =
  "Your entry fee is held until Break & Chill confirms your registration. If it is not confirmed, it is sent back to the GCash number you paid from.";

// The form, one part at a time: the player, the tournament, then paying (or,
// for a free tournament, a last look before registering).
const LAST_STEP = 2;
const DETAIL_FIELDS = ["firstName", "lastName", "contact", "age"];
const EMPTY_FORM = {
  firstName: "", lastName: "", contact: "", age: "", skillLevel: "",
  eventId: "", teamName: "", paymentReference: "",
  // The GCash number the fee came from; null keeps it the same as the contact number.
  payerNumber: null,
};
const isFilled = (form, fields) => fields.every((field) => String(form[field]).trim() !== "");

// Read when the form opens and on submit, never while rendering.
const getCurrentTimestamp = () => Date.now();

const isOpenForRegistration = (event) => ["upcoming", "active"].includes(String(event?.status || "").toLowerCase());

// "Juan Cruz (Team Cue)" and "juan cruz" are the same player.
const playerKey = (label) => String(label || "").replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();

export default function TournamentForm({ events = [], setEvents, onGoBack, initialEventId = null }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    // Already chosen when the player pressed Register on a tournament.
    eventId: events.some((event) => String(event.id) === String(initialEventId) && isOpenForRegistration(event))
      ? String(initialEventId)
      : "",
  }));
  const { step, goTo, title: stepTitle } = useFormSteps();
  // The receipt screenshot, ready to send ({ dataUrl, ... } from utils/receiptImage.js).
  const [receipt, setReceipt] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  // The key this browser follows the sign-up by, its name until the server
  // answers, and whether a fee was paid (see useMyRequests).
  const [followed, setFollowed] = useState(null);
  const myRequests = useMyRequests();
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
  const payerNumber = form.payerNumber ?? form.contact;
  const paymentSettled =
    !paymentRequired || (gcashReady && paymentCheck.isValid && isValidSmsNumber(payerNumber) && Boolean(receipt));
  // What the paid step still needs, said under the button.
  const paymentHint = !paymentRequired || !gcashReady
    ? ""
    : !paymentCheck.isValid
      ? "Pay the entry fee by GCash and type the reference number."
      : !isValidSmsNumber(payerNumber)
        ? "Type the GCash number you paid from."
        : !receipt
          ? "Attach a screenshot of your GCash receipt."
          : "";
  const paymentUnavailable = paymentRequired && !gcashReady
    ? "Online payment is not set up yet. Please register at the hall."
    : "";
  const contactWarning = getSmsWarning(form.contact);
  const playerName = [form.firstName, form.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const alreadyRegistered =
    Boolean(selectedEvent && playerName) &&
    (selectedEvent.participants || []).some((participant) => playerKey(participant) === playerKey(playerName));
  // Each typed field is checked as soon as it has something in it, and said on
  // the step it belongs to.
  const detailsError =
    (form.firstName && getPersonNameError(form.firstName, "first name")) ||
    (form.lastName && getPersonNameError(form.lastName, "last name")) ||
    (form.age !== "" && getAgeError(form.age)) ||
    "";
  const tournamentError =
    (form.teamName.trim().length > 40 && "Keep the team name to 40 characters or fewer.") ||
    (alreadyRegistered && `${playerName} is already registered for ${selectedEvent.name}.`) ||
    "";
  const fieldError = detailsError || tournamentError;

  // What each step needs before Next opens the one after it, and what is said
  // under Next while it is missing.
  const detailsFilled = isFilled(form, DETAIL_FIELDS);
  const skillChosen = Boolean(skillLevelLabel(form.skillLevel));
  const detailsReady = detailsFilled && contactIsValid && skillChosen && !detailsError;
  const detailsHint =
    detailsError ||
    (!detailsFilled
      ? "Fill in your name, contact number and age to continue."
      : !contactIsValid
        ? "Check the contact number above."
        : !skillChosen
          ? "Choose your skill level to continue."
          : "");
  const tournamentFilled = Boolean(selectedEvent);
  // A paid one cannot be taken online until GCash is set up, so it stops here
  // rather than on the payment step.
  const tournamentReady = tournamentFilled && !tournamentError && !paymentUnavailable;
  const tournamentHint =
    tournamentError ||
    paymentUnavailable ||
    (!tournamentFilled ? "Choose the tournament to continue." : "");
  const stepReady = [detailsReady, tournamentReady][step] ?? true;
  const stepHint = [detailsHint, tournamentHint][step] ?? "";
  const steps = ["Details", "Tournament", paymentRequired ? "Pay" : "Confirm"];

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "contact" ? sanitizePhoneInput(value) : value,
    }));
  };

  // A send error belongs to the step it was shown on.
  const openStep = (next) => {
    setSubmitError("");
    goTo(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Before the last step, Next (or Enter in a field) opens the next step.
    if (step < LAST_STEP) {
      if (stepReady) openStep(step + 1);
      return;
    }
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
      const playerLabel = buildParticipantLabel(playerName, { team: form.teamName, skillLevel: form.skillLevel });
      const { event: updatedEvent, statusKey } = await registerWebsiteTournamentParticipant({
        eventId: selectedEvent.id,
        participant: playerLabel,
        // A paid one sends the fee's reference, the number it came from and the receipt.
        payment: paymentRequired
          ? { phone: form.contact, payerNumber, paymentReference: paymentCheck.digits, receipt: receipt.dataUrl }
          : null,
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
      // (Tournament players). This browser keeps only the key, so the player
      // sees when the entry is decided.
      if (statusKey) {
        const label = `${selectedEvent.name} · ${formatEventWhen(selectedEvent.date, selectedEvent.time)}`;
        myRequests.add({ key: statusKey, kind: "tournament", label });
        setFollowed({ key: statusKey, label, paid: paymentRequired });
      }

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
    setFollowed(null);
    setForm(EMPTY_FORM);
    setReceipt(null);
    setSubmitted(false);
    setCustomerMessage(null);
    openStep(0);
  };

  const isComplete = detailsReady && tournamentReady && paymentSettled;

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

          {notices.length > 0 && !submitted && step === 0 && (
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
              <FormSteps steps={steps} current={step} onGo={openStep} label="Registration steps" />

              <div className="form-step-body" key={step}>
                {step === 0 && (
                  <>
                    <FormStepHead
                      step={step}
                      count={steps.length}
                      titleRef={stepTitle}
                      title="Your details"
                      note="We text updates about your registration to this number."
                    />
                    <PersonalInfoForm form={form} onChange={handleChange} contactWarning={contactWarning} />
                  </>
                )}

                {step === 1 && (
                  <>
                    <FormStepHead
                      step={step}
                      count={steps.length}
                      titleRef={stepTitle}
                      title="Tournament details"
                      note="Choose the tournament you are joining. Its details show under it."
                    />
                    <TournamentDetailsForm
                      form={form}
                      onChange={handleChange}
                      events={availableEvents}
                      selectedEvent={selectedEvent}
                    />
                  </>
                )}

                {step === LAST_STEP && (
                  <>
                    <FormStepHead
                      step={step}
                      count={steps.length}
                      titleRef={stepTitle}
                      title={paymentRequired ? "Check and pay" : "Check and register"}
                      note={
                        paymentRequired
                          ? "Check your registration, then pay the entry fee by GCash."
                          : "Check your registration, then register. This tournament has no entry fee."
                      }
                    />
                    <FormReview
                      title="Your registration"
                      rows={[
                        {
                          icon: "bi-person",
                          label: "Player",
                          value: playerName,
                          more: [formatMobile(form.contact), form.age ? `Age ${form.age}` : "", skillLevelLabel(form.skillLevel)],
                          onChange: () => openStep(0),
                          changeLabel: "Change your details",
                        },
                        {
                          icon: "bi-trophy",
                          label: "Tournament",
                          value: selectedEvent?.name || "Not chosen",
                          more: [
                            selectedEvent ? formatEventWhen(selectedEvent.date, selectedEvent.time) : "",
                            selectedEvent
                              ? [gameTypeLabel(selectedEvent.gameType), paymentRequired ? `Entry fee ₱${entryFee.toLocaleString("en-PH")}` : "Free entry"].filter(Boolean).join(" · ")
                              : "",
                            form.teamName.trim() ? `Team / nickname: ${form.teamName.trim()}` : "",
                          ],
                          onChange: () => openStep(1),
                          changeLabel: "Change the tournament details",
                        },
                      ]}
                    />

                    {/* The tournament can close while this step is open. */}
                    {!selectedEvent && (
                      <div className="form-step-stale" role="alert">
                        <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
                        <p>This tournament is no longer open for registration. Please choose another one.</p>
                      </div>
                    )}

                    {paymentRequired && (
                      <GcashPayment
                        title="Pay the entry fee with GCash"
                        total={entryFee}
                        // The summary above already names the tournament and its fee.
                        lines={[]}
                        reference={form.paymentReference}
                        onReferenceChange={(value) =>
                          setForm((previous) => ({ ...previous, paymentReference: value }))
                        }
                        payerNumber={payerNumber}
                        onPayerNumberChange={(value) => setForm((previous) => ({ ...previous, payerNumber: value }))}
                        receipt={receipt}
                        onReceiptChange={setReceipt}
                        heldNote={HELD_NOTE}
                      />
                    )}
                  </>
                )}
              </div>

              <FormStepNav previous={steps[step - 1]} onBack={() => openStep(step - 1)} nextReady={stepReady}>
                {step === LAST_STEP && (
                  <button type="submit" className="submit-btn" disabled={!isComplete}>
                    <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                    Register for Tournament
                  </button>
                )}
              </FormStepNav>
              {step < LAST_STEP
                ? stepHint && (
                    <p className="required-text">
                      <i className="bi bi-info-circle" aria-hidden="true"></i>
                      {stepHint}
                    </p>
                  )
                : !isComplete && (
                    <p className="required-text">
                      <i className="bi bi-info-circle" aria-hidden="true"></i>
                      {fieldError || contactWarning || paymentUnavailable || paymentHint || "Please fill in all required fields"}
                    </p>
                  )}
              {submitError && <p className="required-text">{submitError}</p>}
            </form>
          ) : (
            <>
              <SuccessMessage
                form={form}
                event={selectedEvent}
                onReset={handleReset}
                status={
                  followed && (
                    <RequestStatusCard
                      request={myRequests.requests.find((request) => request.key === followed.key)}
                      fallback={describeJustSent("tournament", followed.label, followed.paid)}
                      textedTo={customerMessage?.status === "sent" ? form.contact : ""}
                    />
                  )
                }
              />
              {paymentRequired && (
                <div className="gcash-held-note">
                  <i className="bi bi-shield-check" aria-hidden="true"></i>
                  <p>{HELD_NOTE}</p>
                </div>
              )}
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
