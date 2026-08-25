import "../../styles/Admin/Reservations.css";
import ReservationFilters from "../../Elements/Admin/ReservationFilters";
import ReservationHeader from "../../Elements/Admin/ReservationHeader";
import ReservationModal from "../../Elements/Admin/ReservationModal";
import ReservationsTable from "../../Elements/Admin/ReservationsTable";
import useAdminReservations from "../../Elements/Admin/useAdminReservations";

export default function Reservations({ reservations, setReservations, tables, setTables, setLogs }) {
  const reservationState = useAdminReservations({
    reservations,
    setReservations,
    tables,
    setTables,
    setLogs,
  });

  return (
    <div className="reservations-container">
      <ReservationHeader onNew={reservationState.openNew} />

      <ReservationFilters
        counts={reservationState.counts}
        filter={reservationState.filter}
        filters={reservationState.statusFilters}
        onChange={reservationState.setFilter}
      />

      <ReservationsTable
        reservations={reservationState.filteredReservations}
        onUpdate={reservationState.updateReservation}
        onEdit={reservationState.openEdit}
        emptyMessage={reservationState.filter === "history" ? "No reservation history yet" : "No active reservations found"}
      />

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
