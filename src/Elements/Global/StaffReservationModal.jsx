import { useState } from "react";
import "../../styles/Admin/CartPanel.css";
import "../../styles/StaffReservation.css";
import PaymentConfirmationModal from "../Admin/PaymentConfirmationModal";
import useClock from "./useClock";
import { useCounterGcash } from "./useCounterGcash";
import { useSiteSettings } from "./useSiteSettings";
import { describePaidBy, getBookingTotal, isDeskPaid } from "../../utils/bookingPayments";
import { formatPeso } from "../../utils/onlinePayments";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { numberFieldValue, numberKeys, readNumberField } from "../../utils/numberField";
import { MAX_PARTY_SIZE, getCustomerNameError, getPartySizeError } from "../../utils/reservationIssues";
import {
  DEFAULT_RESERVATION_DURATION_MINUTES,
  MIN_RESERVATION_HOURS,
  addMinutesToTime,
  checkReservationStart,
  formatHoursLabel,
  formatReservationDate,
  formatReservationTime,
  getOpenTimeWindows,
  getTableReservationAvailability,
  getTodayDate,
} from "../../utils/reservations";
import { readNameField, readTextField } from "../../utils/textField";

const bookedMinutes = (booking) => Number(booking?.durationMinutes) || DEFAULT_RESERVATION_DURATION_MINUTES;

const toForm = (booking) => ({
  customerName: booking?.customerName || booking?.customer || "",
  phone: booking?.phone || "",
  date: booking?.date || getTodayDate(),
  time: booking?.time || "",
  tableId: booking ? String(booking.tableId ?? booking.table ?? "") : "",
  partySize: booking?.partySize ?? booking?.pax ?? 2,
  hours: String(Math.max(MIN_RESERVATION_HOURS, Math.round(bookedMinutes(booking) / 60))),
  notes: booking?.notes || "",
});

const toMinutes = (time) => {
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
};

/**
 * Booking a table at the hall, the same for the admin and the front desk and by
 * the website's rules: the date, a table, its free times, then a start and the
 * hours that fit. A new booking is paid first, through Sales / POS's own
 * payment window, and is saved only once that is done. `booking` edits one
 * instead, which takes no payment: hours already paid for stay as they are.
 *
 * `onCreate({ booking, method, details })` resolves once saved and throws what
 * went wrong, which stays in the payment window. `onSaveEdit(changes)` saves an edit.
 */
export default function StaffReservationModal({
  booking = null,
  tables = [],
  reservations = [],
  events = [],
  transactions = [],
  onCreate,
  onSaveEdit,
  onClose,
}) {
  const editing = Boolean(booking);
  const { hours: openHours } = useSiteSettings().settings;
  const counterGcash = useCounterGcash();
  const clock = useClock();
  const now = new Date(clock);
  const [form, setForm] = useState(() => toForm(booking));
  const [method, setMethod] = useState("cash");
  const [paying, setPaying] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const nameError = form.customerName ? getCustomerNameError(form.customerName) : "";
  const phoneWarning = getSmsWarning(form.phone);
  const partyError = getPartySizeError(form.partySize);

  // Hours already paid for stay as they are, and must fit wherever the booking
  // moves. What was paid stays what it paid for, so it moves only to a table
  // that costs the same.
  const hoursLocked = editing && Number(booking.paymentAmount) > 0;
  const costsTheSame = (table) =>
    !hoursLocked ||
    String(table.id) === String(booking.tableId ?? booking.table) ||
    getBookingTotal(table, bookedMinutes(booking)) === Number(booking.paymentAmount);

  // The table list is judged on the date alone: maintenance and all-day
  // tournament holds. Clashing hours are left out of the free times instead.
  const dayChecks = tables.map((table) => ({
    table,
    ...getTableReservationAvailability({
      table,
      reservations,
      events,
      candidate: { tableId: table.id, date: form.date, time: "" },
      excludeId: booking?.id ?? null,
    }),
  }));
  const tableChoices = dayChecks.filter((entry) => entry.available && costsTheSame(entry.table)).map((entry) => entry.table);
  const closedTables = dayChecks.filter((entry) => !entry.available);
  const selectedTable = tables.find((table) => String(table.id) === form.tableId) || null;
  const tableIsOffered = tableChoices.some((table) => table === selectedTable);
  const tableName = selectedTable?.name || (selectedTable ? `Table ${selectedTable.id}` : "");

  const windows = tableIsOffered
    ? getOpenTimeWindows({
        table: selectedTable,
        reservations,
        events,
        date: form.date,
        excludeId: booking?.id ?? null,
        now,
        hours: openHours,
      })
    : [];
  const startCheck = tableIsOffered
    ? checkReservationStart({ windows, date: form.date, time: form.time, now, hours: openHours })
    : { maxHours: 0, reason: "" };

  const keepsOwnSlot =
    editing &&
    booking.date === form.date &&
    booking.time === form.time &&
    String(booking.tableId ?? booking.table) === form.tableId;
  const maxHours = keepsOwnSlot ? Math.max(startCheck.maxHours, Math.round(bookedMinutes(booking) / 60)) : startCheck.maxHours;
  const chosenHours = Math.min(Number(form.hours) || MIN_RESERVATION_HOURS, maxHours);
  const minutes = hoursLocked ? bookedMinutes(booking) : chosenHours * 60;
  const roomLeft = startCheck.window ? startCheck.window.endMinutes - toMinutes(form.time) : 0;
  const hoursFit = keepsOwnSlot || (startCheck.maxHours >= MIN_RESERVATION_HOURS && minutes <= roomLeft);
  const scheduleError = keepsOwnSlot
    ? ""
    : startCheck.reason ||
      (hoursLocked && form.time && !hoursFit ? `Only ${formatHoursLabel(roomLeft)} is open from ${formatReservationTime(form.time)}, and this booking paid for ${formatHoursLabel(minutes)}.` : "");

  const total = getBookingTotal(selectedTable, minutes);
  const noRate = !editing && Boolean(selectedTable) && (Number(selectedTable.rate) || 0) <= 0;
  const gcashOff = method === "ewallet" && !counterGcash.ready;
  const endTime = form.time && hoursFit ? addMinutesToTime(form.time, minutes) : "";

  const ready =
    Boolean(form.customerName.trim()) &&
    !nameError &&
    isValidSmsNumber(form.phone) &&
    !partyError &&
    Boolean(form.date) &&
    tableIsOffered &&
    Boolean(form.time) &&
    hoursFit &&
    !scheduleError &&
    !noRate &&
    !gcashOff;

  const details = {
    customerName: form.customerName.trim(),
    phone: form.phone.trim(),
    date: form.date,
    time: form.time,
    tableId: selectedTable?.id,
    tableName,
    partySize: Number(form.partySize),
    durationMinutes: minutes,
    notes: form.notes.trim(),
  };

  if (paying) {
    const usedReferences = transactions.map((tx) => tx.paymentDetails?.referenceNumber).filter(Boolean);
    return (
      <PaymentConfirmationModal
        cart={[{ id: "booking", name: `${tableName} · ${formatHoursLabel(minutes)}`, price: total, qty: 1, isTableCharge: true }]}
        total={total}
        method={method}
        billLabel={`${tableName} · ${details.customerName}`}
        intro={
          <>
            Paying for <strong>{details.customerName}</strong>&apos;s booking on {formatReservationDate(form.date)} at{" "}
            {formatReservationTime(form.time)}. The table is booked only once this is paid.
          </>
        }
        finalNote="This will save the booking and record the sale."
        usedReferences={usedReferences}
        onCancel={() => setPaying(false)}
        onSubmit={(paid) =>
          onCreate({
            booking: {
              ...details,
              paymentMethod: method === "cash" ? "cash" : "gcash",
              paymentReference: paid.referenceNumber || "",
              paymentAmount: total,
            },
            method,
            details: paid,
          })
        }
      />
    );
  }

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="staff-booking-title">
        <div className="modal-dialog modal-dialog-centered staff-booking-dialog">
          <div className="modal-content staff-booking">
            <div className="modal-header">
              <h5 className="modal-title" id="staff-booking-title">
                <i className="bi bi-calendar-check me-2"></i>
                {editing ? "Edit Reservation" : "New Reservation"}
              </h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              <div className="staff-booking-grid">
                <div>
                  <label className="form-label" htmlFor="staff-booking-name">Customer Name</label>
                  <input
                    id="staff-booking-name"
                    type="text"
                    className="form-control"
                    maxLength={40}
                    value={form.customerName}
                    onChange={(event) => update("customerName", readNameField(event))}
                    placeholder="Full name"
                    aria-invalid={Boolean(nameError)}
                  />
                  {nameError && <p className="staff-booking-error" role="alert">{nameError}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="staff-booking-phone">Phone Number</label>
                  <input
                    id="staff-booking-phone"
                    type="text"
                    className="form-control"
                    value={form.phone}
                    onChange={(event) => update("phone", sanitizePhoneInput(event.target.value))}
                    placeholder="09XXXXXXXXX"
                    inputMode="numeric"
                    maxLength="11"
                  />
                  {phoneWarning && <p className="staff-booking-error" role="alert">{phoneWarning}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="staff-booking-date">Date</label>
                  <input
                    id="staff-booking-date"
                    type="date"
                    className="form-control"
                    min={getTodayDate(now)}
                    value={form.date}
                    onChange={(event) => update("date", event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="staff-booking-pax">Number of Pax</label>
                  <input
                    id="staff-booking-pax"
                    type="number"
                    className="form-control"
                    min="1"
                    max={MAX_PARTY_SIZE}
                    value={numberFieldValue(form.partySize)}
                    onChange={(event) => update("partySize", readNumberField(event))}
                    {...numberKeys()}
                    aria-invalid={Boolean(partyError)}
                  />
                  {partyError && <p className="staff-booking-error" role="alert">{partyError}</p>}
                </div>

                <div className="staff-booking-wide">
                  <label className="form-label" htmlFor="staff-booking-table">Table</label>
                  <select
                    id="staff-booking-table"
                    className="form-select"
                    value={form.tableId}
                    onChange={(event) => update("tableId", event.target.value)}
                  >
                    <option value="">Select table...</option>
                    {selectedTable && !tableIsOffered && <option value={form.tableId}>{tableName} (not available)</option>}
                    {tableChoices.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name || `Table ${table.id}`} · {formatPeso(table.rate)}/hr
                      </option>
                    ))}
                  </select>
                  {closedTables.map(({ table, reason }) => (
                    <p key={table.id} className="staff-booking-note">
                      <i className="bi bi-info-circle" aria-hidden="true"></i> {reason}
                    </p>
                  ))}
                  {noRate && <p className="staff-booking-error" role="alert">{tableName} has no rate yet. Set it in Pool Tables first.</p>}
                  {tableIsOffered && (
                    <p className="staff-booking-free">
                      <i className="bi bi-clock" aria-hidden="true"></i>
                      {windows.length ? (
                        <span>Free: {windows.map((window) => window.label).join(" · ")}</span>
                      ) : (
                        <span>No free time left on this table for that date.</span>
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label" htmlFor="staff-booking-time">Start Time</label>
                  <input
                    id="staff-booking-time"
                    type="time"
                    className="form-control"
                    value={form.time}
                    onChange={(event) => update("time", event.target.value)}
                    disabled={!tableIsOffered}
                    aria-invalid={Boolean(scheduleError)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="staff-booking-hours">Hours</label>
                  {hoursLocked ? (
                    <input id="staff-booking-hours" className="form-control" value={formatHoursLabel(minutes)} disabled readOnly />
                  ) : (
                    <select
                      id="staff-booking-hours"
                      className="form-select"
                      value={maxHours ? String(chosenHours) : ""}
                      onChange={(event) => update("hours", event.target.value)}
                      disabled={!maxHours}
                    >
                      {!maxHours && <option value="">Pick a start time</option>}
                      {Array.from({ length: maxHours }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {formatHoursLabel(count * 60)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {scheduleError && <p className="staff-booking-error staff-booking-wide" role="alert">{scheduleError}</p>}
                {endTime && <p className="staff-booking-ends staff-booking-wide">Ends {formatReservationTime(endTime)}</p>}

                <div className="staff-booking-wide">
                  <label className="form-label" htmlFor="staff-booking-notes">Notes (optional)</label>
                  <textarea
                    id="staff-booking-notes"
                    className="form-control"
                    rows="2"
                    value={form.notes}
                    onChange={(event) => update("notes", readTextField(event))}
                    placeholder="Any special requests..."
                  />
                </div>
              </div>

              {editing ? (
                hoursLocked && (
                  <p className="staff-booking-note">
                    <i className="bi bi-info-circle" aria-hidden="true"></i> Paid {formatPeso(booking.paymentAmount)}
                    {isDeskPaid(booking) ? ` ${describePaidBy(booking)}` : " online"} for {formatHoursLabel(minutes)}. To change
                    the hours or move to a table with another rate, cancel this booking and book again.
                  </p>
                )
              ) : (
                <div className="staff-booking-pay">
                  <div className="staff-booking-total">
                    <span>
                      Pay first
                      {selectedTable && chosenHours > 0 && (
                        <small>
                          {formatHoursLabel(minutes)} × {formatPeso(selectedTable.rate)}/hr
                        </small>
                      )}
                    </span>
                    <strong>{formatPeso(total)}</strong>
                  </div>
                  <div className="payment-methods" role="group" aria-label="Payment method">
                    <button
                      type="button"
                      className={`payment-method-btn ${method === "cash" ? "active" : ""}`}
                      aria-pressed={method === "cash"}
                      onClick={() => setMethod("cash")}
                    >
                      <i className="bi bi-cash"></i>
                      Cash
                    </button>
                    <button
                      type="button"
                      className={`payment-method-btn ${method === "ewallet" ? "active" : ""}`}
                      aria-pressed={method === "ewallet"}
                      onClick={() => setMethod("ewallet")}
                      disabled={!counterGcash.ready}
                    >
                      <i className="bi bi-phone"></i>
                      GCash
                    </button>
                  </div>
                  {counterGcash.note && (
                    <p className="staff-booking-note">
                      <i className="bi bi-info-circle" aria-hidden="true"></i> {counterGcash.note}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              {editing ? (
                <button type="button" className="btn btn-success" onClick={() => onSaveEdit(details)} disabled={!ready}>
                  <i className="bi bi-check-circle me-2"></i>
                  Save Changes
                </button>
              ) : (
                <button type="button" className="btn btn-success" onClick={() => setPaying(true)} disabled={!ready}>
                  <i className="bi bi-credit-card me-2"></i>
                  Continue to Payment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
