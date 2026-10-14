import "../../styles/Admin/Reservations.css";
import ReservationFilters from "../../Elements/Admin/ReservationFilters";
import ReservationHeader from "../../Elements/Admin/ReservationHeader";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import useAdminReservations from "../../Elements/Admin/useAdminReservations";
import Pagination from "../../Elements/Global/Pagination";

// `focusReservationId`: a booking opened from the admin's bell, shown marked on
// its page of the list.
export default function Reservations({
  focusReservationId = null,
  reservations,
  setReservations,
  tables,
  setTables,
  tableCharges,
  setTableCharges,
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
    tableCharges,
    setTableCharges,
    setLogs,
    focusReservationId,
  });
  const { focusBooking } = reservationState;

  return (
    <div className="reservations-container">
      <ReservationHeader
        onNew={reservationState.openNew}
        onlineReservationsOpen={onlineReservationsOpen}
        isUpdatingOnlineReservations={isUpdatingOnlineReservations}
        onOnlineReservationsChange={onOnlineReservationsChange}
      />

      {focusReservationId !== null && !focusBooking && (
        <p className="reservations-focus-missing" role="status">
          <i className="bi bi-info-circle" aria-hidden="true"></i>
          That online reservation is no longer in the list. It may have been removed; the latest bookings are below.
        </p>
      )}

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
        highlightId={focusBooking ? focusBooking.id : null}
        emptyMessage={
          reservationState.search
            ? `No reservations match "${reservationState.search}"`
            : reservationState.filter === "history"
              ? "No reservation history yet"
              : "No active reservations found"
        }
      />

      <Pagination
        page={reservationState.page}
        pageCount={reservationState.pageCount}
        pageStart={reservationState.pageStart}
        pageSize={reservationState.pageSize}
        total={reservationState.totalMatches}
        goToPage={reservationState.goToPage}
      />

      {reservationState.modal === "form" && (
        <ReservationModal
          form={reservationState.form}
          setForm={reservationState.setForm}
          editId={reservationState.editId}
          scheduleError={reservationState.scheduleError}
          tableError={reservationState.tableError}
          chosenTableName={reservationState.chosenTableName}
          tables={reservationState.availableTables}
          onClose={() => reservationState.setModal(null)}
          onSave={reservationState.saveReservation}
        />
      )}
    </div>
  );
}
