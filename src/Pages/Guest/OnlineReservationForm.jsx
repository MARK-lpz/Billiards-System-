import { useEffect, useMemo, useState } from "react";
import "../../styles/Guest/Fill-up/FormBase.css";
import "../../styles/Guest/Fill-up/TournaHeader.css";
import "../../styles/Guest/Fill-up/Fields.css";
import "../../styles/Guest/Fill-up/SuccessMess.css";
import {
  MIN_RESERVATION_HOURS,
  RESERVATION_CLOSED_HOURS_MESSAGE,
  RESERVATION_CUTOFF_TIME,
  RESERVATION_OPEN_TIME,
  addMinutesToTime,
  checkReservationStart,
  describeReservationTime,
  formatHoursLabel,
  getBookedSlotsForDate,
  getOpenTimeWindows,
  getTableReservationAvailability,
  hasReservationConflict,
  isOutsideReservationHours,
} from "../../utils/reservations";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { useNotifications } from "../../Elements/Global/useNotifications";
import { createRemoteReservation } from "../../utils/reservationApi";
import GcashPayment from "../../Elements/Guest/GcashPayment";
import { validateReference } from "../../utils/paymentReference";
import { sendCustomerConfirmation } from "../../utils/customerMessageApi";

const getToday = () => new Date().toLocaleDateString("en-CA");
const PUBLIC_RESERVATION_CUTOFF_LABEL = "10:00 PM";

const initialForm = {
  customerName: "",
  phone: "",
  date: getToday(),
  time: "",
  // Whole hours, kept as the select's string value.
  hours: String(MIN_RESERVATION_HOURS),
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
  // { text, status } from the server; status says whether it was really texted.
  const [customerMessage, setCustomerMessage] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A guest who is still on this page when closing comes is stopped too, not only
  // the landing page button.
  const [afterHours, setAfterHours] = useState(isOutsideReservationHours);

  useEffect(() => {
    const interval = window.setInterval(() => setAfterHours(isOutsideReservationHours()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

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

  // What is already taken on the chosen date, so guests can see when a table frees up.
  const bookedSlots = useMemo(
    () => getBookedSlotsForDate({ tables, reservations, events, date: form.date }),
    [tables, reservations, events, form.date]
  );

  const selectedTable = tables.find((table) => String(table.id) === form.tableId);
  const tableLabel = selectedTable ? selectedTable.name || `Table ${selectedTable.id}` : "";
  const paymentCheck = validateReference(form.paymentReference || "");

  // When this one table is still free, so the guest knows how long they can stay
  // before typing a start time.
  const openWindows = useMemo(
    () => getOpenTimeWindows({ table: selectedTable, reservations, events, date: form.date }),
    [selectedTable, reservations, events, form.date]
  );

  // How many hours fit from the start time the guest typed.
  const startCheck = selectedTable
    ? checkReservationStart({ windows: openWindows, date: form.date, time: form.time })
    : { maxHours: 0, reason: "" };
  const reservationHours = Number(form.hours) || 0;
  const reservationMinutes = reservationHours * 60;
  const startIsOpen = Boolean(form.time) && startCheck.maxHours >= MIN_RESERVATION_HOURS;
  // Someone else can book part of the stretch while this form is open, so the
  // chosen hours are checked again rather than trusted.
  const hoursFit = startIsOpen && reservationHours >= MIN_RESERVATION_HOURS && reservationHours <= startCheck.maxHours;
  const hoursWarning =
    startIsOpen && !hoursFit
      ? `Only ${formatHoursLabel(startCheck.maxHours * 60)} ${startCheck.maxHours === 1 ? "is" : "are"} open from ${formatTime(form.time)} now. Please choose fewer hours.`
      : "";
  const endTime = hoursFit ? addMinutesToTime(form.time, reservationMinutes) : "";
  const reservationTotal = selectedTable && hoursFit ? Number(selectedTable.rate || 0) * reservationHours : 0;
  const hourOptions = Array.from({ length: startCheck.maxHours }, (_, index) => index + 1);

  const unavailableTables = [...tableDayAvailability.entries()]
    .filter(([, availability]) => !availability.available)
    .map(([id, availability]) => ({ table: tables.find((table) => String(table.id) === id), ...availability }));

  const updateForm = (field, value) => {
    setSubmitError("");
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? sanitizePhoneInput(value) : value,
      // A new date invalidates the table, and a new table invalidates the start
      // time and hours, because free time is worked out per table.
      ...(field === "date" ? { tableId: "", time: "", hours: String(MIN_RESERVATION_HOURS) } : {}),
      ...(field === "tableId" ? { time: "", hours: String(MIN_RESERVATION_HOURS) } : {}),
    }));
  };

  // A later start can leave less room, so hours that no longer fit are trimmed to
  // what does instead of leaving the guest on a choice the list no longer offers.
  const changeStartTime = (time) => {
    const { maxHours } = checkReservationStart({ windows: openWindows, date: form.date, time });
    setSubmitError("");
    setForm((current) => ({
      ...current,
      time,
      hours: maxHours >= MIN_RESERVATION_HOURS && Number(current.hours) > maxHours ? String(maxHours) : current.hours,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!onlineReservationsOpen) {
      setSubmitError("Online reservations are temporarily closed by the owner. Please check back later.");
      return;
    }

    if (isOutsideReservationHours()) {
      setAfterHours(true);
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
      setSubmitError("Please enter the time you want to start.");
      return;
    }

    if (startCheck.reason) {
      setSubmitError(startCheck.reason);
      return;
    }

    if (!hoursFit) {
      setSubmitError(hoursWarning || "Please choose how many hours you want to reserve.");
      return;
    }

    if (!paymentCheck.isValid) {
      setSubmitError(
        paymentCheck.error || "Please pay through GCash and enter the reference number from your receipt."
      );
      return;
    }

    // The whole stay is checked, not just its first hour.
    const candidate = {
      tableId: selectedTable.id,
      date: form.date,
      time: form.time,
      durationMinutes: reservationMinutes,
    };
    const availability = getTableReservationAvailability({ table: selectedTable, reservations, events, candidate });
    if (!availability.available) {
      setSubmitError(availability.reason || "This table is not available for the selected time.");
      return;
    }
    if (hasReservationConflict(reservations, candidate)) {
      setSubmitError("This table was just reserved for that time. Please choose another table.");
      return;
    }

    const reservation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerName: form.customerName.trim(),
      phone: form.phone,
      date: form.date,
      time: form.time,
      // The guest no longer states a head count, so the record keeps the minimum.
      partySize: 1,
      tableId: selectedTable.id,
      tableName: selectedTable.name || `Table ${selectedTable.id}`,
      notes: form.notes.trim(),
      status: "pending",
      source: "online",
      durationMinutes: reservationMinutes,
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
        message: `New online reservation: ${savedReservation.customerName} requested ${savedReservation.tableName} on ${formatDate(savedReservation.date)}, ${describeReservationTime(savedReservation)}.`,
        data: { reservationId: savedReservation.id, tableId: savedReservation.tableId },
      });
      // A failed text must never lose a paid reservation, so this is best effort.
      try {
        setCustomerMessage(
          await sendCustomerConfirmation({ context: "reservation", referenceId: savedReservation.id })
        );
      } catch (messageError) {
        console.warn("Unable to send the customer confirmation", messageError);
      }

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
    setCustomerMessage(null);
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
                  ["Time", describeReservationTime(submittedReservation), "bi-clock"],
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
                    <strong>
                      {customerMessage.status === "sent" ? `Texted to ${submittedReservation.phone}` : "Your confirmation"}
                    </strong>
                  </div>
                  <p className="customer-message-body">{customerMessage.text}</p>
                  <p className="customer-message-note">Keep this for your records.</p>
                </div>
              )}

              <button type="button" className="submit-btn reservation-another-btn" onClick={resetForm}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                Reserve Another Table
              </button>
            </div>
          ) : afterHours ? (
            <div className="success-container success-bounce" role="status">
              <div className="success-icon">
                <i className="bi bi-calendar-x-fill"></i>
              </div>
              <h2 className="success-title">Reservations Closed</h2>
              <p className="success-message">{RESERVATION_CLOSED_HOURS_MESSAGE}</p>
            </div>
          ) : (
            <form className="fade-in" onSubmit={handleSubmit}>
              <p className="section-title">Contact Information</p>
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-name">Full Name</label>
                <input id="reservation-name" className="field-input" value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} placeholder="Juan dela Cruz" required />
              </div>
              <div className="form-field-full">
                <label className="label" htmlFor="reservation-phone">Contact No.</label>
                <input id="reservation-phone" className="field-input" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="09XX XXX XXXX" inputMode="numeric" maxLength="11" required />
                {phoneWarning && <p className="field-warning">{phoneWarning}</p>}
              </div>

              <p className="section-title">Reservation Details</p>
              <p className="reservation-closing-notice">
                <i className="bi bi-clock" aria-hidden="true"></i>
                Break &amp; Chill closes at {PUBLIC_RESERVATION_CUTOFF_LABEL}. Each booking is {MIN_RESERVATION_HOURS} hour or more and must finish by closing.
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
                    Once you choose a table, its open times appear below so you can see how many hours you can book.
                  </p>
                </div>
              )}
              {selectedTable && (
                <div className="reservation-booked-times reservation-open-times">
                  <div className="reservation-booked-head">
                    <i className="bi bi-clock-history" aria-hidden="true"></i>
                    <strong>Open times for {tableLabel} on {formatDate(form.date)}</strong>
                  </div>

                  {openWindows.length ? (
                    <ul className="reservation-booked-list">
                      {openWindows.map((openWindow) => (
                        <li key={openWindow.start} className="reservation-booked-row open">
                          <span className="reservation-booked-table">{openWindow.label}</span>
                          <span className="reservation-booked-time">
                            Up to {formatHoursLabel(openWindow.maxHours * 60)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reservation-booked-closed">
                      {tableLabel} has no open time left on this date. Please pick another table or date.
                    </p>
                  )}

                  {openWindows.length > 0 && (
                    <p className="reservation-booked-note">
                      Type the time you want to start inside one of these open times, then choose how many hours to stay.
                    </p>
                  )}
                </div>
              )}

              <div className="form-grid-2">
                <div>
                  <label className="label" htmlFor="reservation-time">Start Time</label>
                  <input
                    id="reservation-time"
                    className="field-input"
                    type="time"
                    min={RESERVATION_OPEN_TIME}
                    max={addMinutesToTime(RESERVATION_CUTOFF_TIME, -MIN_RESERVATION_HOURS * 60)}
                    value={form.time}
                    onChange={(event) => changeStartTime(event.target.value)}
                    disabled={!selectedTable || openWindows.length === 0}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="reservation-hours">Number of Hours</label>
                  <select
                    id="reservation-hours"
                    className="field-input"
                    value={hoursFit ? form.hours : ""}
                    onChange={(event) => updateForm("hours", event.target.value)}
                    disabled={!startIsOpen}
                    required
                  >
                    {!hoursFit && (
                      <option value="">
                        {!selectedTable
                          ? "Select a table first"
                          : !form.time
                            ? "Enter a start time first"
                            : startIsOpen
                              ? "Choose hours"
                              : "Not available"}
                      </option>
                    )}
                    {hourOptions.map((hours) => (
                      <option key={hours} value={hours}>
                        {formatHoursLabel(hours * 60)} (until {formatTime(addMinutesToTime(form.time, hours * 60))})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!selectedTable && <p className="field-helper reservation-time-helper">Choose a table first to see when it is open.</p>}
              {startCheck.reason && <p className="field-warning reservation-schedule-warning">{startCheck.reason}</p>}
              {hoursWarning && <p className="field-warning reservation-schedule-warning">{hoursWarning}</p>}

              {selectedTable && hoursFit && (
                <GcashPayment
                  title="Pay with GCash to hold your table"
                  total={reservationTotal}
                  lines={[
                    { label: "Table", value: tableLabel },
                    { label: "Rate", value: `PHP ${Number(selectedTable.rate || 0).toLocaleString("en-PH")} per hour` },
                    { label: "Reserved time", value: `${formatTime(form.time)} - ${formatTime(endTime)}` },
                    { label: "Hours", value: formatHoursLabel(reservationMinutes) },
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
              <button type="submit" className="submit-btn" disabled={isSubmitting || !form.customerName.trim() || !isValidSmsNumber(form.phone) || !form.date || !form.time || !form.tableId || !paymentCheck.isValid || Boolean(startCheck.reason) || !hoursFit}>
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
