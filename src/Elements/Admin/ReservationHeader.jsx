export default function ReservationHeader({
  onNew,
  onlineReservationsOpen,
  isUpdatingOnlineReservations,
  onOnlineReservationsChange,
}) {
  const toggleOnlineReservations = async () => {
    if (!onOnlineReservationsChange || isUpdatingOnlineReservations) return;

    try {
      await onOnlineReservationsChange(!onlineReservationsOpen);
    } catch {
      // The current setting remains visible when the API update fails.
    }
  };

  return (
    <div className="reservations-header">
      <div>
        <h1 className="reservations-title">Reservations</h1>
        <p className="reservations-subtitle">View and manage all table reservations</p>
      </div>
      <div className="reservations-header-actions">
        <div className={`online-reservations-status ${onlineReservationsOpen ? "is-open" : "is-closed"}`}>
          <span>
            <strong>Online reservations</strong>
            <small>{onlineReservationsOpen ? "Open to the public" : "Temporarily closed"}</small>
          </span>
          <button
            type="button"
            className="online-reservations-toggle"
            role="switch"
            aria-checked={onlineReservationsOpen}
            aria-label={onlineReservationsOpen ? "Close online reservations" : "Open online reservations"}
            disabled={isUpdatingOnlineReservations}
            onClick={toggleOnlineReservations}
          >
            <span aria-hidden="true"></span>
          </button>
        </div>
        <button className="btn btn-success reservations-add-btn" onClick={onNew}>
          <i className="bi bi-plus-circle me-2"></i>
          New Reservation
        </button>
      </div>
    </div>
  );
}
