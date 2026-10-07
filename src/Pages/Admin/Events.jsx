import { useState } from "react";
import "../../styles/Admin/Events.css";
import EventsModal from "../../Elements/Admin/EventsModal";
import EventsStats from "../../Elements/Admin/EventStats";
import EventCard from "../../Elements/Admin/EventCard";
import { useNotifications } from "../../Elements/Global/useNotifications";
import ConfirmDialog from "../../Elements/Global/ConfirmDialog";
import Pagination from "../../Elements/Global/Pagination";
import usePagination from "../../Elements/Global/usePagination";
import {
  MAX_EVENT_REASON_LENGTH,
  formatEventWhen,
  getEventScheduleError,
  getScheduleChange,
} from "../../utils/eventUpdates";

// When staff cancelled or moved an event, as shown to players on the website.
const getCurrentIsoTime = () => new Date().toISOString();
const cleanReason = (reason) => String(reason || "").trim().slice(0, MAX_EVENT_REASON_LENGTH);

// Kept outside the component: the React lint rules flag Date.now() inside it.
const getCurrentTimestamp = () => Date.now();

const getEventStart = (event) => {
  const start = new Date(`${event.date}T${event.time || "00:00"}`);
  return Number.isNaN(start.getTime()) ? null : start;
};

// Still to be played or being played; completed and cancelled ones are previous events.
const ACTIVE_EVENT_STATUSES = new Set(["upcoming", "active"]);
const isActiveEvent = (event) => ACTIVE_EVENT_STATUSES.has(String(event.status || "upcoming").toLowerCase());

const EVENT_VIEWS = [
  { value: "active", label: "Active Events", icon: "bi-calendar-event" },
  { value: "previous", label: "Previous Events", icon: "bi-clock-history" },
];

// Events without a readable date go to the end of either list.
const startTimeOr = (event, missing) => getEventStart(event)?.getTime() ?? missing;
const soonestFirst = (first, second) =>
  startTimeOr(first, Number.MAX_SAFE_INTEGER) - startTimeOr(second, Number.MAX_SAFE_INTEGER);
const latestFirst = (first, second) =>
  startTimeOr(second, Number.MIN_SAFE_INTEGER) - startTimeOr(first, Number.MIN_SAFE_INTEGER);

const formatEventStart = (event) => {
  const start = getEventStart(event);
  if (!start) return [event.date, event.time].filter(Boolean).join(" ");
  return start.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(event.time ? { hour: "numeric", minute: "2-digit" } : {}),
  });
};

export default function Events({ events, setEvents, tables }) {
  const { addNotification } = useNotifications();
  const [modal, setModal] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  // Optional, and shown on the website next to the cancelled event.
  const [cancelReason, setCancelReason] = useState("");
  // Completing locks the event for good, so the button only arms this confirmation.
  const [completeTarget, setCompleteTarget] = useState(null);
  // Which list is shown: events still to come, or completed and cancelled ones.
  const [view, setView] = useState("active");
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

  // The event as it was before this edit, to tell whether its date or time moved.
  const editedEvent = form.id ? events.find((event) => event.id === form.id) || null : null;
  const scheduleChange = getScheduleChange(editedEvent, form);
  // An edit that keeps the event's date and time is fine even once it has
  // passed; a new event, or a new date or time, must still be ahead.
  const scheduleError = !form.id || scheduleChange ? getEventScheduleError(form.date, form.time) : "";

  const save = () => {
    if (scheduleError) {
      window.alert(scheduleError);
      return;
    }

    const normalizedTables = resolveAssignedTables(form.tables);
    // A new date or time is published as a reschedule, so players see both.
    const rescheduleDetails = scheduleChange
      ? {
          rescheduledFrom: scheduleChange.from,
          rescheduledAt: getCurrentIsoTime(),
          rescheduleReason: cleanReason(form.rescheduleReason),
        }
      : null;

    setEvents((prev) => {
      if (form.id) {
        return prev.map((event) =>
          event.id === form.id
            ? {
                ...event,
                ...form,
                tables: normalizedTables,
                participants: event.participants || [],
                rescheduleReason: event.rescheduleReason || "",
                ...rescheduleDetails,
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
    addNotification({
      message: rescheduleDetails
        ? `${form.name} rescheduled to ${formatEventWhen(form.date, form.time)}. The website now shows the new schedule.`
        : `${form.name} event ${form.id ? "updated" : "created"}.`,
    });
    setModal(null);
  };

  // A completed tournament is final: it can never be cancelled afterwards.
  const cancelEvent = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || event.status === "completed" || event.status === "cancelled") {
      setCancelTarget(null);
      return;
    }

    const details = { status: "cancelled", cancelledAt: getCurrentIsoTime(), cancelReason: cleanReason(cancelReason) };
    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, ...details } : ev)));
    addNotification({
      message: `${event.name || "Event"} cancelled. The website now shows it as cancelled, and it moved to Previous Events.`,
    });
    setCancelTarget(null);
  };

  const markComplete = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    if (!event || event.status !== "upcoming") return;

    setEvents(prev => prev.map(ev => 
      ev.id === eventId ? { ...ev, status: "completed" } : ev
    ));
    addNotification({ message: `${event?.name || "Event"} marked completed. It moved to Previous Events.` });
  };

  const requestComplete = (event) => {
    const start = getEventStart(event);
    setCompleteTarget({ event, notStartedYet: Boolean(start && start.getTime() > getCurrentTimestamp()) });
  };

  // Takes the target as an argument rather than reading `completeTarget` from the
  // closure: the React Compiler narrows a closed-over `completeTarget.event` into a
  // render-time check, which throws while the target is still null.
  const confirmComplete = (target) => {
    markComplete(target.event.id);
    setCompleteTarget(null);
  };

  const describeComplete = (target) => {
    const { event, notStartedYet } = target;
    const players = event.participants?.length || 0;
    return {
      message: `Mark ${event.name || "this event"} (${formatEventStart(event)}) as completed?`,
      detail: [
        notStartedYet ? "Heads up: this event has not started yet." : "",
        `${players} registered ${players === 1 ? "player stays" : "players stay"} on record.`,
        "Once completed, the event is locked: it can no longer be edited or cancelled.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  };

  const completeDialog = completeTarget ? describeComplete(completeTarget) : null;

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
      rescheduleReason: "",
    });
    setModal("form");
  };

  const stats = {
    upcoming: events.filter(e => e.status === "upcoming").length,
    completed: events.filter(e => e.status === "completed").length,
    totalParticipants: events.reduce((s, e) => s + e.participants.length, 0),
  };

  // Active events read soonest first; previous ones most recent first.
  const activeEvents = events.filter(isActiveEvent).sort(soonestFirst);
  const previousEvents = events.filter((event) => !isActiveEvent(event)).sort(latestFirst);
  const eventCounts = { active: activeEvents.length, previous: previousEvents.length };
  const pagination = usePagination(view === "active" ? activeEvents : previousEvents);

  const changeView = (nextView) => {
    setView(nextView);
    pagination.goToPage(1);
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

      <div className="events-tabs" role="tablist" aria-label="Event list">
        {EVENT_VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            className={`events-tab-btn ${view === option.value ? "active" : ""}`}
            onClick={() => changeView(option.value)}
          >
            <i className={`bi ${option.icon}`}></i>
            {option.label}
            <span className="events-tab-count">({eventCounts[option.value]})</span>
          </button>
        ))}
      </div>

      {pagination.total === 0 ? (
        <div className="events-empty">
          {view === "active"
            ? "No active events. Use Create Event to add a tournament."
            : "No previous events yet. Completed and cancelled events show up here."}
        </div>
      ) : (
        <div className="events-list">
          {pagination.items.map(e => (
            <EventCard
              key={e.id}
              event={e}
              tables={tables}
              onEdit={() => editEvent(e)}
              onMarkComplete={() => requestComplete(e)}
              onCancel={() => {
                setCancelReason("");
                setCancelTarget(e);
              }}
            />
          ))}
        </div>
      )}

      <Pagination {...pagination} />

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
                  <p className="events-cancel-copy">
                    The website will show players that this tournament is cancelled.
                  </p>
                  <div className="mb-3 events-reason-field">
                    <label className="form-label" htmlFor="event-cancel-reason">
                      Reason for players (optional)
                    </label>
                    <input
                      id="event-cancel-reason"
                      type="text"
                      className="form-control"
                      maxLength={MAX_EVENT_REASON_LENGTH}
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="e.g. Not enough players signed up"
                    />
                  </div>
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

      {completeTarget && completeDialog && (
        <ConfirmDialog
          title="Mark Event as Completed?"
          message={completeDialog.message}
          detail={completeDialog.detail}
          confirmLabel="Yes, Mark Completed"
          cancelLabel="Not yet"
          confirmClassName="btn-success"
          icon="bi-trophy-fill"
          onConfirm={() => confirmComplete(completeTarget)}
          onClose={() => setCompleteTarget(null)}
        />
      )}

      {modal === "form" && (
        <EventsModal
          form={form}
          setForm={setForm}
          tables={tables || []}
          isEdit={Boolean(form.id)}
          scheduleChange={scheduleChange}
          scheduleError={scheduleError}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
