import { useState } from "react";
import "../../styles/Admin/Events.css";
import EventsModal from "../../Elements/Admin/EventsModal";
import EventsStats from "../../Elements/Admin/EventStats";
import EventCard from "../../Elements/Admin/EventCard";

export default function Events({ events, setEvents, tables }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ 
    name: "", 
    date: "", 
    time: "", 
    prize: 0, 
    status: "upcoming",
    tables: []
  });
  const [addPInput, setAddPInput] = useState({});

  const save = () => {
    setEvents(prev => [...prev, { 
      id: Date.now(), 
      ...form, 
      participants: [], 
      tables: form.tables || [] 
    }]);
    setModal(null);
  };

  const addParticipant = (eventId, name) => {
    if (!name.trim()) return;
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, participants: [...e.participants, name] } : e
    ));
  };

  const markComplete = (eventId) => {
    setEvents(prev => prev.map(ev => 
      ev.id === eventId ? { ...ev, status: "completed" } : ev
    ));
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
            setForm({ name: "", date: "", time: "", prize: 0, status: "upcoming" }); 
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
            addPInput={addPInput[e.id] || ""}
            onAddPInputChange={(value) => setAddPInput({ ...addPInput, [e.id]: value })}
            onAddParticipant={() => {
              addParticipant(e.id, addPInput[e.id] || "");
              setAddPInput({ ...addPInput, [e.id]: "" });
            }}
            onMarkComplete={() => markComplete(e.id)}
          />
        ))}
      </div>

      {modal === "form" && (
        <EventsModal
          form={form}
          setForm={setForm}
          tables={tables || []}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}