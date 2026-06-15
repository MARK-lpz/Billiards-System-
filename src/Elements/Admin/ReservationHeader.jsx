export default function ReservationHeader({ onNew }) {
  return (
    <div className="reservations-header">
      <div>
        <h1 className="reservations-title">Reservations</h1>
        <p className="reservations-subtitle">View and manage all table reservations</p>
      </div>
      <button className="btn btn-success reservations-add-btn" onClick={onNew}>
        <i className="bi bi-plus-circle me-2"></i>
        New Reservation
      </button>
    </div>
  );
}
