import { useMemo, useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import {
  getAvailableReservationTables,
  RESERVATION_CUTOFF_TIME,
  getReservationValidationMessage,
  hasReservationConflict,
} from "../../utils/reservations";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { createRemoteReservation } from "../../utils/reservationApi";

const getToday = () => new Date().toLocaleDateString("en-CA");
const PUBLIC_RESERVATION_CUTOFF_LABEL = "10:00 PM";

const getPublicScheduleMessage = (date, time) => {
  const validationMessage = getReservationValidationMessage(date, time);
  return time >= RESERVATION_CUTOFF_TIME
    ? `Break & Chill closes at ${PUBLIC_RESERVATION_CUTOFF_LABEL}. Please select a reservation time before closing.`
    : validationMessage;
};

const initialForm = {
  customerName: "",
  phone: "",
  email: "",
  date: getToday(),
  time: "",
  partySize: 2,
  tableId: "",
  notes: "",
};

const formatDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const formatTime = (time) =>
  new Date(`2000-01-01T${time}`).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export default function OnlineReservationForm({
  tables = [],
  reservations = [],
  setReservations,
  onGoBack,
}) {
  const { queueStaffNotification } = useNotifications();
  const [form, setForm] = useState(initialForm);
  const [submittedReservation, setSubmittedReservation] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTables = useMemo(
    () =>
      getAvailableReservationTables({
        tables,
        reservations,
        date: form.date,
        time: form.time,
      }),
    [tables, reservations, form.date, form.time]
  );
  const phoneWarning = getSmsWarning(form.phone);
  const scheduleWarning = form.date && form.time ? getPublicScheduleMessage(form.date, form.time) : "";
  const selectedTable = availableTables.find((table) => String(table.id) === form.tableId);

  const updateForm = (field, value) => {
    setSubmitError("");
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? sanitizePhoneInput(value) : value,
      ...(field === "date" || field === "time" ? { tableId: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidSmsNumber(form.phone)) {
      setSubmitError("Please enter a valid mobile number in 09XXXXXXXXX format.");
      return;
    }

    const validationMessage = getPublicScheduleMessage(form.date, form.time);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    if (!selectedTable) {
      setSubmitError("Please select an available table.");
      return;
    }

    const candidate = { tableId: selectedTable.id, date: form.date, time: form.time };
    if (hasReservationConflict(reservations, candidate)) {
      setSubmitError("This table was just reserved for that time. Please choose another table.");
      return;
    }

    const reservation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerName: form.customerName.trim(),
      phone: form.phone,
      email: form.email.trim(),
      date: form.date,
      time: form.time,
      partySize: Number(form.partySize) || 1,
      tableId: selectedTable.id,
      tableName: selectedTable.name || `Table ${selectedTable.id}`,
      notes: form.notes.trim(),
      status: "pending",
      source: "online",
      requestedAt: new Date().toISOString(),
    };

    try {
      setIsSubmitting(true);
      const savedReservation = await createRemoteReservation(reservation);
      setReservations((current) => [...current, savedReservation]);
      queueStaffNotification({
        type: "online-reservation",
        message: `New online reservation: ${savedReservation.customerName} requested ${savedReservation.tableName} on ${formatDate(savedReservation.date)} at ${formatTime(savedReservation.time)}.`,
        data: { reservationId: savedReservation.id, tableId: savedReservation.tableId },
      });
      setSubmittedReservation(savedReservation);
    } catch (error) {
      setSubmitError(error.message || "Unable to send your reservation request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setSubmittedReservation(null);
    setSubmitError("");
  };

  return (
    <div className="tournament-container">
      <button type="button" className="tournament-back-btn" onClick={onGoBack} title="Back to showcase">
        <i className="bi bi-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </button>

      <div className="tournament-wrapper">
        <header className="tournament-header fade-in">
          <div style={{ marginBottom: 10 }}>
            <i className="bi bi-calendar2-check-fill trophy-icon"></i>
          </div>
          <div className="tournament-header-lines">
            <div className="header-line-left" />
            <span className="header-est">Break &amp; Chill</span>
            <div className="header-line-right" />
          </div>
          <h1 className="tournament-title">TABLE RESERVATION</h1>
          <p className="tournament-subtitle">Online Reservation Request</p>
        </header>

        <div className="tournament-card">
          <div className="card-top-line" />

          {submittedReservation ? (
            <div className="success-container success-bounce">
              <div className="success-icon">
                <i className="bi bi-calendar2-check-fill"></i>
              </div>
              <h2 className="success-title">Request Sent!</h2>
              <p className="success-message">We will review your table reservation, {submittedReservation.customerName}.</p>
              <div className="success-details">
                {[
                  ["Table", submittedReservation.tableName, "bi-grid-3x3-gap"],
                  ["Date", formatDate(submittedReservation.date), "bi-calendar-event"],
                  ["Time", formatTime(submittedReservation.time), "bi-clock"],
                  ["Guests", submittedReservation.partySize, "bi-people"],
                  ["Contact", submittedReservation.phone, "bi-telephone"],
                ].map(([label, value, icon]) => (
                  <div key={label} className="detail-row">
                    <span className="detail-label"><i className={`bi ${icon}`} aria-hidden="true"></i>{label}</span>
                    <span className="detail-value">{value}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="submit-btn reservation-another-btn" onClick={resetForm}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                Reserve Another Table
              </button>
            </div>
          ) : (
            <form className="fade-in" onSubmit={handleSubmit}>
              <p className="section-title">Contact Information</p>
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-name">Full Name</label>
                <input id="reservation-name" className="field-input" value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} placeholder="Juan dela Cruz" required />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="label" htmlFor="reservation-phone">Contact No.</label>
                  <input id="reservation-phone" className="field-input" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="09XX XXX XXXX" inputMode="numeric" maxLength="11" required />
                  {phoneWarning && <p className="field-warning">{phoneWarning}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="reservation-email">Email Address</label>
                  <input id="reservation-email" className="field-input" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="juan@email.com" required />
                </div>
              </div>

              <p className="section-title">Reservation Details</p>
              <p className="reservation-closing-notice">
                <i className="bi bi-clock" aria-hidden="true"></i>
                Online reservations must start before {PUBLIC_RESERVATION_CUTOFF_LABEL}. Break &amp; Chill closes at {PUBLIC_RESERVATION_CUTOFF_LABEL}.
              </p>
              <div className="form-grid-2">
                <div>
                  <label className="label" htmlFor="reservation-date">Date</label>
                  <input id="reservation-date" className="field-input" type="date" min={getToday()} value={form.date} onChange={(event) => updateForm("date", event.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="reservation-time">Time</label>
                  <input id="reservation-time" className="field-input" type="time" max="21:59" value={form.time} onChange={(event) => updateForm("time", event.target.value)} required />
                </div>
              </div>
              {scheduleWarning && <p className="field-warning reservation-schedule-warning">{scheduleWarning}</p>}
              <div className="form-grid-2">
                <div>
                  <label className="label" htmlFor="reservation-guests">Number of Guests</label>
                  <input id="reservation-guests" className="field-input" type="number" min="1" max="20" value={form.partySize} onChange={(event) => updateForm("partySize", event.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="reservation-table">Available Table</label>
                  <select id="reservation-table" className="field-input" value={form.tableId} onChange={(event) => updateForm("tableId", event.target.value)} required>
                    <option value="">{form.time ? "Select a table" : "Select date and time first"}</option>
                    {availableTables.map((table) => (
                      <option key={table.id} value={table.id}>{table.name || `Table ${table.id}`} - PHP {table.rate}/hr</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-notes">Notes</label>
                <textarea id="reservation-notes" className="field-input reservation-notes" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional special request" rows="3" />
              </div>

              {submitError && <p className="field-warning reservation-submit-error">{submitError}</p>}
              <button type="submit" className="submit-btn" disabled={isSubmitting || !form.customerName.trim() || !isValidSmsNumber(form.phone) || !form.email.trim() || !form.date || !form.time || !form.tableId || Boolean(scheduleWarning)}>
                <i className="bi bi-calendar2-check" aria-hidden="true"></i>
                {isSubmitting ? "Sending Request..." : "Send Reservation Request"}
              </button>
              <p className="required-text"><i className="bi bi-info-circle" aria-hidden="true"></i>Reservations are subject to Admin confirmation.</p>
            </form>
          )}
        </div>

        <p className="tournament-footer">2026 Break &amp; Chill Billiards</p>
      </div>
    </div>
  );
}
