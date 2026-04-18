// ReservationModal.jsx
import { useEffect } from "react";
import { getSmsWarning, isValidSmsNumber, sanitizePhoneInput } from "../../utils/phone";

export default function ReservationModal({
  mode,
  walkInForm,
  setWalkInForm,
  reservationForm,
  setReservationForm,
  availableTables,
  reservationTables,
  onClose,
  onWalkInSubmit,
  onReservationSubmit,
}) {
  const phoneWarning = getSmsWarning(reservationForm.phone);
  const phoneIsValid = !reservationForm.phone.trim() || isValidSmsNumber(reservationForm.phone);

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
                    value={reservationForm.customerName}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        customerName: e.target.value,
                      }))
                    }
                  />

                  <input
                    className="rd-input"
                    placeholder="Phone number"
                    value={reservationForm.phone}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        phone: sanitizePhoneInput(e.target.value),
                      }))
                    }
                    inputMode="numeric"
                    maxLength="11"
                  />
                  {phoneWarning && <p className="rd-field-warning">{phoneWarning}</p>}

                  <input
                    className="rd-input"
                    type="date"
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
                    value={reservationForm.time}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        time: e.target.value,
                      }))
                    }
                  />

                  <input
                    className="rd-input"
                    type="number"
                    min="1"
                    placeholder="Party size"
                    value={reservationForm.partySize}
                    onChange={(e) =>
                      setReservationForm((prev) => ({
                        ...prev,
                        partySize: e.target.value,
                      }))
                    }
                  />

                  <select
                    className="rd-select"
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
                    {reservationTables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name || `Table ${table.id}`}
                      </option>
                    ))}
                  </select>

                  <button
                    className="rd-primary-btn rd-form-submit"
                    type="submit"
                    disabled={
                      !reservationForm.customerName.trim() ||
                      !phoneIsValid ||
                      !reservationForm.date ||
                      !reservationForm.time ||
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
