import { useState } from "react";
import "../../styles/Admin/Events.css";
import EventsModal from "../../Elements/Admin/EventsModal";
import EventsStats from "../../Elements/Admin/EventStats";
import EventCard from "../../Elements/Admin/EventCard";
import { useNotifications } from "../../Elements/Global/useNotifications";

export default function Events({ events, setEvents, tables }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [form, setForm] = useState({ 
    name: "", 
    date: "", 
    time: "", 
    prize: 0, 
    entryFee: 0,
    status: "upcoming",
    gameType: "8-ball",
    tables: []
  });

  const resolveAssignedTables = (assignedTables = []) =>
    (assignedTables || [])
      .map((assigned) => {
        const matched = (tables || []).find((table) => table.id === assigned || table.name === assigned);
        return matched ? matched.id : null;
      })
      .filter((value) => value !== null);

  const save = () => {
    const normalizedTables = resolveAssignedTables(form.tables);

    setEvents((prev) => {
      if (form.id) {
        return prev.map((event) =>
          event.id === form.id
            ? {
                ...event,
                ...form,
                tables: normalizedTables,
                participants: event.participants || [],
              }
            : event
        );
      }

      return [
        ...prev,
        {
          id: Date.now(),
          ...form,
          participants: [],
          tables: normalizedTables,
        },
      ];
    });
    addNotification({ message: `${form.name} event ${form.id ? "updated" : "created"}.` });
    setModal(null);
  };

  // A completed tournament is final: it can never be cancelled afterwards.
  const cancelEvent = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || event.status === "completed" || event.status === "cancelled") {
      setCancelTarget(null);
      return;
    }

    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, status: "cancelled" } : ev)));
    addNotification({ message: `${event.name || "Event"} cancelled.` });
    setCancelTarget(null);
  };

  const markComplete = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    setEvents(prev => prev.map(ev => 
      ev.id === eventId ? { ...ev, status: "completed" } : ev
    ));
    addNotification({ message: `${event?.name || "Event"} marked completed.` });
  };

  const editEvent = (event) => {
    setForm({
      id: event.id,
      name: event.name || "",
      date: event.date || "",
      time: event.time || "",
      prize: event.prize || 0,
      entryFee: event.entryFee || 0,
      status: event.status || "upcoming",
      gameType: event.gameType || "8-ball",
      tables: event.tables || [],
    });
    setModal("form");
  };

  const stats = {
    upcoming: events.filter(e => e.status === "upcoming").length,
    completed: events.filter(e => e.status === "completed").length,
    totalParticipants: events.reduce((s, e) => s + e.participants.length, 0),
  };

  return (
    <div className="events-container">
      {/* Header */}
      <div className="events-header">
        <div>
          <h1 className="events-title">Events & Tournaments</h1>
          <p className="events-subtitle">Manage billiard events and tournament brackets</p>
        </div>
        <button 
          className="btn btn-success events-add-btn" 
          onClick={() => { 
            setForm({ name: "", date: "", time: "", prize: 0, entryFee: 0, status: "upcoming", gameType: "8-ball", tables: [] }); 
            setModal("form"); 
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Create Event
        </button>
      </div>

      <EventsStats stats={stats} />

      <div className="events-list">
        {events.map(e => (
          <EventCard
            key={e.id}
            event={e}
            tables={tables}
            onEdit={() => editEvent(e)}
            onMarkComplete={() => markComplete(e.id)}
            onCancel={() => setCancelTarget(e)}
          />
        ))}
      </div>

      {cancelTarget && (
        <>
          <div className="modal-backdrop show" onClick={() => setCancelTarget(null)} />
          <div className="modal show" style={{ display: "flex" }} onClick={() => setCancelTarget(null)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Cancel this tournament?</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setCancelTarget(null)}></button>
                </div>
                <div className="modal-body">
                  <p className="events-cancel-copy">
                    <strong>{cancelTarget.name}</strong> will be marked cancelled and will stop accepting
                    registrations. Players already registered stay on record.
                  </p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setCancelTarget(null)}>
                    Keep Event
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => cancelEvent(cancelTarget.id)}>
                    Yes, Cancel Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {modal === "form" && (
        <EventsModal
          form={form}
          setForm={setForm}
          tables={tables || []}
          isEdit={Boolean(form.id)}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
