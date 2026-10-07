import "../../styles/Admin/Reservations.css";
import ReservationFilters from "../../Elements/Admin/ReservationFilters";
import ReservationHeader from "../../Elements/Admin/ReservationHeader";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import useAdminReservations from "../../Elements/Admin/useAdminReservations";
import Pagination from "../../Elements/Global/Pagination";

export default function Reservations({
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
          tables={reservationState.availableTables}
          onClose={() => reservationState.setModal(null)}
          onSave={reservationState.saveReservation}
        />
      )}
    </div>
  );
}
