import "../../styles/Admin/Reservations.css";
import ReservationFilters from "../../Elements/Admin/ReservationFilters";
import ReservationHeader from "../../Elements/Admin/ReservationHeader";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import useAdminReservations from "../../Elements/Admin/useAdminReservations";

export default function Reservations({
  reservations,
  setReservations,
  tables,
  setTables,
  setLogs,
  onlineReservationsOpen,
  isUpdatingOnlineReservations,
  onOnlineReservationsChange,
}) {
  const reservationState = useAdminReservations({
    reservations,
    setReservations,
    tables,
    setTables,
    setLogs,
  });

  return (
    <div className="reservations-container">
      <ReservationHeader
        onNew={reservationState.openNew}
        onlineReservationsOpen={onlineReservationsOpen}
        isUpdatingOnlineReservations={isUpdatingOnlineReservations}
        onOnlineReservationsChange={onOnlineReservationsChange}
      />

      <ReservationFilters
        counts={reservationState.counts}
        filter={reservationState.filter}
        filters={reservationState.statusFilters}
        onChange={reservationState.setFilter}
        search={reservationState.search}
        onSearchChange={reservationState.setSearch}
      />

      <ReservationsTable
        reservations={reservationState.filteredReservations}
        onUpdate={reservationState.updateReservation}
        onEdit={reservationState.openEdit}
        emptyMessage={
          reservationState.search
            ? `No reservations match "${reservationState.search}"`
            : reservationState.filter === "history"
              ? "No reservation history yet"
              : "No active reservations found"
        }
      />

      {reservationState.totalMatches > 0 && (
        <div className="reservations-pagination">
          <span className="reservations-pagination-count">
            Showing {reservationState.pageStart + 1}
            &ndash;{Math.min(reservationState.pageStart + reservationState.pageSize, reservationState.totalMatches)}
            {" "}of {reservationState.totalMatches}
          </span>

          <div className="reservations-pagination-controls">
            <button
              type="button"
              className="reservations-page-btn"
              onClick={() => reservationState.goToPage(reservationState.page - 1)}
              disabled={reservationState.page <= 1}
            >
              <i className="bi bi-chevron-left"></i>
              Previous
            </button>

            <span className="reservations-page-indicator">
              Page {reservationState.page} of {reservationState.pageCount}
            </span>

            <button
              type="button"
              className="reservations-page-btn"
              onClick={() => reservationState.goToPage(reservationState.page + 1)}
              disabled={reservationState.page >= reservationState.pageCount}
            >
              Next
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {reservationState.modal === "form" && (
        <ReservationModal
          form={reservationState.form}
          setForm={reservationState.setForm}
          editId={reservationState.editId}
          tables={reservationState.availableTables}
          onClose={() => reservationState.setModal(null)}
          onSave={reservationState.saveReservation}
        />
      )}
    </div>
  );
}
