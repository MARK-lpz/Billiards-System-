// ReservationModal.jsx
import { useEffect } from "react";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";
import { formatReservationTime, getReservationScheduleError, getTodayDate } from "../../utils/reservations";
import { useSiteSettings } from "../Global/useSiteSettings";
import { MAX_PARTY_SIZE, getCustomerNameError, getPartySizeError } from "../../utils/reservationIssues";

export default function ReservationModal({
  mode,
  walkInForm,
  setWalkInForm,
  reservationForm,
  setReservationForm,
  availableTables,
  reservationTables,
  tableError = "",
  chosenTableName = "",
  onClose,
  onWalkInSubmit,
  onReservationSubmit,
}) {
  // The hall's hours (Admin > Website), which bookings must keep to.
  const { hours } = useSiteSettings().settings;
  const phoneWarning = getSmsWarning(reservationForm.phone);
  // Required: every booking must have a number to reach the customer, and the
  // server refuses bookings without one.
  const phoneIsValid = isValidSmsNumber(reservationForm.phone);
  // Checked once something is typed, so an empty form does not open full of red.
  const nameError = reservationForm.customerName ? getCustomerNameError(reservationForm.customerName) : "";
  const partySizeError = getPartySizeError(reservationForm.partySize);
  // Shown as soon as a past date is picked, not only when Save is pressed.
  const scheduleError = getReservationScheduleError(reservationForm.date, reservationForm.time, undefined, hours);
  // A table picked before the date or time changed may no longer be offered;
  // it stays in the list, marked, so the reason below matches what is selected.
  const chosenTableMissing =
    Boolean(reservationForm.tableId) &&
    !reservationTables.some((table) => String(table.id) === String(reservationForm.tableId));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />

      <div className="modal show" style={{ display: "flex" }} onClick={onClose}>
        <div
          className="modal-dialog modal-dialog-centered"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {mode === "walkin" ? (
                  <>
                    <i className="bi bi-person-walking me-2"></i>
                    Accept Walk-In
                  </>
                ) : (
                  <>
                    <i className="bi bi-calendar-check me-2"></i>
                    Create Reservation
                  </>
                )}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              {mode === "walkin" && (
                <form className="rd-form" onSubmit={onWalkInSubmit}>
                  <input
                    className="rd-input"
                    placeholder="Customer name"
                    value={walkInForm.customerName}
                    onChange={(e) =>
                      setWalkInForm((prev) => ({
                        ...prev,
                        customerName: e.target.value,
                      }))
                    }
                  />

                  <select
                    className="rd-select"
                    value={walkInForm.tableId}
                    onChange={(e) =>
                      setWalkInForm((prev) => ({
                        ...prev,
                        tableId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select available table...</option>
                    {availableTables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name || `Table ${table.id}`}
                      </option>
                    ))}
                  </select>

                  <button
                    className="rd-primary-btn"
                    type="submit"
                    disabled={!walkInForm.customerName.trim() || !walkInForm.tableId}
                  >
                    Start Walk-In
                  </button>
                </form>
              )}

              {mode === "reservation" && (
                <form className="rd-form rd-form-grid" onSubmit={onReservationSubmit}>
                  <input
                    className="rd-input"
                    placeholder="Customer name"
                    aria-invalid={Boolean(nameError)}
                    maxLength={50}
                    value={reservationForm.customerName}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        customerName: e.target.value,
                      }))
                    }
                  />
                  {nameError && <p className="rd-field-warning" role="alert">{nameError}</p>}

                  <input
                    className="rd-input"
                    placeholder="Mobile number (09XXXXXXXXX)"
                    value={reservationForm.phone}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        phone: sanitizePhoneInput(e.target.value),
                      }))
                    }
                    inputMode="numeric"
                    maxLength="11"
                    required
                  />
                  {phoneWarning && <p className="rd-field-warning">{phoneWarning}</p>}

                  <input
                    className="rd-input"
                    type="date"
                    min={getTodayDate()}
                    aria-invalid={Boolean(scheduleError)}
                    value={reservationForm.date}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                  />

                  <input
                    className="rd-input"
                    type="time"
                    max="21:59"
                    value={reservationForm.time}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        time: e.target.value,
                      }))
                    }
                  />

                  {scheduleError && <p className="rd-field-warning" role="alert">{scheduleError}</p>}
                  <p className="rd-field-hint">Reservation cutoff: {formatReservationTime(hours.close)}</p>

                  <input
                    className="rd-input"
                    type="number"
                    min="1"
                    max={MAX_PARTY_SIZE}
                    step="1"
                    placeholder="Party size"
                    aria-invalid={Boolean(partySizeError)}
                    value={reservationForm.partySize}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        partySize: e.target.value,
                      }))
                    }
                  />
                  {partySizeError && <p className="rd-field-warning" role="alert">{partySizeError}</p>}

                  <select
                    className="rd-select"
                    aria-invalid={Boolean(tableError)}
                    value={reservationForm.tableId}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        tableId: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {reservationForm.date && reservationForm.time
                        ? "Assign table for selected time..."
                        : "Assign table (availability updates after time selection)..."}
                    </option>
                    {chosenTableMissing && (
                      <option value={reservationForm.tableId}>{chosenTableName || "Selected table"} (not available)</option>
                    )}
                    {reservationTables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name || `Table ${table.id}`}
                      </option>
                    ))}
                  </select>
                  {tableError && <p className="rd-field-warning" role="alert">{tableError}</p>}

                  <button
                    className="rd-primary-btn rd-form-submit"
                    type="submit"
                    disabled={
                      !reservationForm.customerName.trim() ||
                      Boolean(nameError) ||
                      !phoneIsValid ||
                      Boolean(partySizeError) ||
                      !reservationForm.date ||
                      !reservationForm.time ||
                      Boolean(scheduleError) ||
                      Boolean(tableError) ||
                      !reservationForm.tableId
                    }
                  >
                    Save Reservation
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
