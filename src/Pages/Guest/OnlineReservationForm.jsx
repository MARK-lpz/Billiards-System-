import { useMemo, useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  RESERVATION_CUTOFF_TIME,
  getAvailableTimeSlots,
  getBookedSlotsForDate,
  getReservationValidationMessage,
  getTableReservationAvailability,
  hasReservationConflict,
} from "../../utils/reservations";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { createRemoteReservation } from "../../utils/reservationApi";
import GcashPayment from "../../Elements/Guest/GcashPayment";
import { validateReference } from "../../utils/paymentReference";
import { queueCustomerMessage } from "../../utils/customerMessageApi";
import { buildReservationMessage } from "../../utils/customerMessages";

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
  tableId: "",
  notes: "",
  paymentReference: "",
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
  events = [],
  setReservations,
  onGoBack,
  onlineReservationsOpen = true,
}) {
  const { queueStaffNotification } = useNotifications();
  const [form, setForm] = useState(initialForm);
  const [submittedReservation, setSubmittedReservation] = useState(null);
  const [customerMessage, setCustomerMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The table is picked before the time, so the list is judged on the date alone:
  // maintenance and all-day tournament holds. Clashing hours are dropped from the
  // time slots instead, which is why a table can be open while some hours are not.
  const tableDayAvailability = useMemo(
    () =>
      new Map(
        tables.map((table) => [
          String(table.id),
          getTableReservationAvailability({
            table,
            reservations,
            events,
            candidate: { tableId: table.id, date: form.date, time: "" },
          }),
        ])
      ),
    [tables, reservations, events, form.date]
  );
  const phoneWarning = getSmsWarning(form.phone);
  const scheduleWarning = form.date && form.time ? getPublicScheduleMessage(form.date, form.time) : "";
  // One hour of table time is charged up front, so the guest pays a real total.
  const reservationHours = DEFAULT_RESERVATION_DURATION_MINUTES / 60;

  // What is already taken on the chosen date, so guests can see when a table frees up.
  const bookedSlots = useMemo(
    () => getBookedSlotsForDate({ tables, reservations, events, date: form.date }),
    [tables, reservations, events, form.date]
  );

  const selectedTable = tables.find((table) => String(table.id) === form.tableId);
  const reservationTotal = selectedTable ? Number(selectedTable.rate || 0) * reservationHours : 0;
  const paymentCheck = validateReference(form.paymentReference || "");

  // Only the times this one table can still take, so the guest cannot pick a clash.
  const availableTimeSlots = useMemo(
    () => getAvailableTimeSlots({ table: selectedTable, reservations, events, date: form.date }),
    [selectedTable, reservations, events, form.date]
  );

  const selectedTableAvailability = selectedTable
    ? getTableReservationAvailability({
        table: selectedTable,
        reservations,
        events,
        candidate: { tableId: selectedTable.id, date: form.date, time: form.time },
      })
    : null;
  const unavailableTables = [...tableDayAvailability.entries()]
    .filter(([, availability]) => !availability.available)
    .map(([id, availability]) => ({ table: tables.find((table) => String(table.id) === id), ...availability }));

  const updateForm = (field, value) => {
    setSubmitError("");
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? sanitizePhoneInput(value) : value,
      // A new date invalidates the table, and a new table invalidates the hour,
      // because free hours are worked out per table.
      ...(field === "date" ? { tableId: "", time: "" } : {}),
      ...(field === "tableId" ? { time: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!onlineReservationsOpen) {
      setSubmitError("Online reservations are temporarily closed by the owner. Please check back later.");
      return;
    }

    if (!isValidSmsNumber(form.phone)) {
      setSubmitError("Please enter a valid mobile number in 09XXXXXXXXX format.");
      return;
    }

    if (!selectedTable) {
      setSubmitError("Please select an available table.");
      return;
    }

    if (!form.time) {
      setSubmitError("Please select an available time for this table.");
      return;
    }

    const validationMessage = getPublicScheduleMessage(form.date, form.time);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    if (!selectedTableAvailability?.available) {
      setSubmitError(selectedTableAvailability?.reason || "This table is not available for the selected time.");
      return;
    }

    if (!paymentCheck.isValid) {
      setSubmitError(
        paymentCheck.error || "Please pay through GCash and enter the reference number from your receipt."
      );
      return;
    }

    const candidate = {
      tableId: selectedTable.id,
      date: form.date,
      time: form.time,
      durationMinutes: DEFAULT_RESERVATION_DURATION_MINUTES,
    };
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
      // The guest no longer states a head count, so the record keeps the minimum.
      partySize: 1,
      tableId: selectedTable.id,
      tableName: selectedTable.name || `Table ${selectedTable.id}`,
      notes: form.notes.trim(),
      status: "pending",
      source: "online",
      durationMinutes: DEFAULT_RESERVATION_DURATION_MINUTES,
      paymentMethod: "gcash",
      paymentReference: paymentCheck.digits,
      paymentAmount: reservationTotal,
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
      const message = buildReservationMessage({
        customerName: savedReservation.customerName,
        tableName: savedReservation.tableName,
        date: formatDate(savedReservation.date),
        time: formatTime(savedReservation.time),
        total: reservationTotal,
        reference: paymentCheck.digits,
      });

      // A failed text must never lose a paid reservation, so this is best effort.
      try {
        await queueCustomerMessage({
          phone: savedReservation.phone,
          customerName: savedReservation.customerName,
          context: "reservation",
          referenceId: savedReservation.id,
          message,
        });
      } catch (messageError) {
        console.warn("Unable to queue the customer confirmation", messageError);
      }

      setCustomerMessage(message);
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
    setCustomerMessage("");
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

          {!onlineReservationsOpen ? (
            <div className="success-container success-bounce" role="status">
              <div className="success-icon">
                <i className="bi bi-calendar-x-fill"></i>
              </div>
              <h2 className="success-title">Online Reservations Closed</h2>
              <p className="success-message">The owner has temporarily closed online reservations. Please check back later.</p>
            </div>
          ) : submittedReservation ? (
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
                  ["Contact", submittedReservation.phone, "bi-telephone"],
                  ["GCash reference", submittedReservation.paymentReference || form.paymentReference, "bi-receipt"],
                  ["Amount paid", `PHP ${Number(submittedReservation.paymentAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, "bi-cash-coin"],
                ].map(([label, value, icon]) => (
                  <div key={label} className="detail-row">
                    <span className="detail-label"><i className={`bi ${icon}`} aria-hidden="true"></i>{label}</span>
                    <span className="detail-value">{value}</span>
                  </div>
                ))}
              </div>
              {customerMessage && (
                <div className="customer-message-card">
                  <div className="customer-message-head">
                    <i className="bi bi-chat-left-text-fill" aria-hidden="true"></i>
                    <strong>Sent to {submittedReservation.phone}</strong>
                  </div>
                  <p className="customer-message-body">{customerMessage}</p>
                  <p className="customer-message-note">
                    Keep this for your records. We will message the same number once staff confirm your booking.
                  </p>
                </div>
              )}

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
                  <label className="label" htmlFor="reservation-email">Email Address (Optional)</label>
                  <input id="reservation-email" className="field-input" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="juan@email.com" />
                  <p className="field-hint">We confirm by text. Add an email only if you want a copy there too.</p>
                </div>
              </div>

              <p className="section-title">Reservation Details</p>
              <p className="reservation-closing-notice">
                <i className="bi bi-clock" aria-hidden="true"></i>
                Each booking runs {DEFAULT_RESERVATION_DURATION_MINUTES} minutes and must finish by {PUBLIC_RESERVATION_CUTOFF_LABEL}, when Break &amp; Chill closes.
              </p>
              <div className="form-grid-2">
                <div>
                  <label className="label" htmlFor="reservation-date">Date</label>
                  <input id="reservation-date" className="field-input" type="date" min={getToday()} value={form.date} onChange={(event) => updateForm("date", event.target.value)} required />
                </div>
                <div>
                  <label className="label" htmlFor="reservation-table">Available Table</label>
                  <select id="reservation-table" className="field-input" value={form.tableId} onChange={(event) => updateForm("tableId", event.target.value)} required>
                    <option value="">{form.date ? "Select a table" : "Select a date first"}</option>
                    {tables.map((table) => {
                      const availability = tableDayAvailability.get(String(table.id));
                      const isUnavailable = !availability?.available;
                      const label = `${table.name || `Table ${table.id}`} - PHP ${table.rate}/hr`;

                      return (
                        <option key={table.id} value={table.id} disabled={isUnavailable}>
                          {isUnavailable ? `${label} (${availability.reason})` : label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              {scheduleWarning && <p className="field-warning reservation-schedule-warning">{scheduleWarning}</p>}

              {form.date && (
                <div className="reservation-booked-times">
                  <div className="reservation-booked-head">
                    <i className="bi bi-calendar-week" aria-hidden="true"></i>
                    <strong>Already booked on {formatDate(form.date)}</strong>
                  </div>

                  {bookedSlots.length ? (
                    <ul className="reservation-booked-list">
                      {bookedSlots.map((slot) => (
                        <li key={slot.key} className={`reservation-booked-row ${slot.type}`}>
                          <span className="reservation-booked-table">{slot.tableName}</span>
                          <span className="reservation-booked-time">
                            {slot.allDay ? `Whole day - ${slot.title}` : `${slot.start} to ${slot.end}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reservation-booked-empty">
                      No bookings yet for this date. Every table is open.
                    </p>
                  )}

                  <p className="reservation-booked-note">
                    Each booking runs {DEFAULT_RESERVATION_DURATION_MINUTES} minutes. Once you choose a table, the time list shows only the hours it can still take.
                  </p>
                </div>
              )}
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-time">Available Time</label>
                <select
                  id="reservation-time"
                  className="field-input"
                  value={form.time}
                  onChange={(event) => updateForm("time", event.target.value)}
                  disabled={!selectedTable || availableTimeSlots.length === 0}
                  required
                >
                  <option value="">
                    {!selectedTable
                      ? "Select a table first"
                      : availableTimeSlots.length === 0
                        ? "No open time left for this table"
                        : "Select an available time"}
                  </option>
                  {availableTimeSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
                {selectedTable && availableTimeSlots.length === 0 && (
                  <p className="field-warning">
                    {selectedTable.name || `Table ${selectedTable.id}`} has no open hours left on this date. Please pick another table or date.
                  </p>
                )}
              </div>
              {selectedTable && form.time && selectedTableAvailability?.available && (
                <GcashPayment
                  title="Pay with GCash to hold your table"
                  total={reservationTotal}
                  lines={[
                    { label: "Table", value: selectedTable.name || `Table ${selectedTable.id}` },
                    { label: "Rate", value: `PHP ${Number(selectedTable.rate || 0).toLocaleString("en-PH")} per hour` },
                    {
                      label: "Reserved time",
                      value: `${formatTime(form.time)} (${DEFAULT_RESERVATION_DURATION_MINUTES} minutes)`,
                    },
                  ]}
                  reference={form.paymentReference}
                  onReferenceChange={(value) => updateForm("paymentReference", value)}
                  disabled={isSubmitting}
                />
              )}

              {unavailableTables.length > 0 && (
                <div className="reservation-availability-notice" role="status">
                  <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                  <div>
                    <strong>Currently unavailable</strong>
                    {unavailableTables.map(({ table, reason }) => (
                      <span key={table?.id}>{reason}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-notes">Notes</label>
                <textarea id="reservation-notes" className="field-input reservation-notes" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional special request" rows="3" />
              </div>

              {submitError && <p className="field-warning reservation-submit-error">{submitError}</p>}
              <button type="submit" className="submit-btn" disabled={isSubmitting || !form.customerName.trim() || !isValidSmsNumber(form.phone) || !form.date || !form.time || !form.tableId || !paymentCheck.isValid || Boolean(scheduleWarning)}>
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
