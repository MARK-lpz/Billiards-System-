/**
 * Players registered for tournaments, as the staff's Tournament Schedule shows
 * them. A participant is stored as one label: "Ana Cruz", "Ana Cruz (Team)",
 * "Ana Cruz (Walk-in)" or "Ana Cruz (Team, Walk-in)". Online players also have
 * the confirmation text the server saved for them, which holds their number.
 */
import { getOpenEvents } from "./eventUpdates";

export const SEEN_REGISTRATIONS_KEY = "seenTournamentRegistrations";

const WALK_IN_TAG = "walk-in";

const normalize = (text) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

export const parseParticipant = (label = "") => {
  const text = String(label).trim();
  const match = text.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!match) return { name: text, team: "", walkIn: false };

  const parts = match[2].split(",").map((part) => part.trim()).filter(Boolean);
  const walkIn = parts.length > 0 && normalize(parts[parts.length - 1]) === WALK_IN_TAG;
  return { name: match[1].trim(), team: (walkIn ? parts.slice(0, -1) : parts).join(", "), walkIn };
};

export const registrationKey = (eventId, label) => `${eventId}::${normalize(label)}`;

/**
 * Everyone registered for a tournament that is still to come: soonest
 * tournament first, and in each the latest player first.
 */
export const getRegistrations = (events = [], now = Date.now()) =>
  getOpenEvents(events, now).flatMap((event) => {
    const participants = Array.isArray(event.participants) ? event.participants : [];
    return participants
      .map((label, index) => ({
        key: registrationKey(event.id, label),
        event,
        label,
        position: index + 1,
        ...parseParticipant(label),
      }))
      .reverse();
  });

/** The registration for one label in one tournament, or null once it is gone. */
export const findRegistration = (events = [], eventId, label) => {
  const event = events.find((entry) => String(entry.id) === String(eventId));
  const participants = Array.isArray(event?.participants) ? event.participants : [];
  const index = participants.findIndex((entry) => normalize(entry) === normalize(label));
  if (index < 0) return null;
  return { key: registrationKey(event.id, label), event, label: participants[index], position: index + 1, ...parseParticipant(participants[index]) };
};

/** The confirmation text saved when this player registered online, if any. */
export const findConfirmation = (messages = [], eventId, name) =>
  messages.find(
    (message) =>
      message.context === "tournament" &&
      String(message.referenceId) === String(eventId) &&
      normalize(message.customerName) === normalize(name)
  ) || null;

/** "GCash ₱300.00 paid · ref 1234567890", "No entry fee", or "" when the text does not say. */
export const describePayment = (text = "") => {
  if (/No entry fee\./i.test(text)) return "No entry fee";
  const paid = text.match(/GCash PHP ([\d,]+(?:\.\d+)?) paid(?:, ref (\d+))?/i);
  if (!paid) return "";
  return `GCash ₱${paid[1]} paid${paid[2] ? ` · ref ${paid[2]}` : ""}`;
};

/** A MySQL DATETIME ("2026-10-13 14:05:00") or ISO time, for people to read. */
export const formatRegisteredAt = (value) => {
  const parsed = value ? new Date(String(value).replace(" ", "T")) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

/**
 * The registrations already looked at on this device. The first time, every
 * current one counts as seen, so the bell only counts players who sign up after.
 */
export const readSeenRegistrations = (events = []) => {
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_REGISTRATIONS_KEY) || "null");
    if (Array.isArray(stored)) return new Set(stored);
  } catch {
    // Unreadable: start over from the current list.
  }
  return new Set(getRegistrations(events, Date.now()).map((registration) => registration.key));
};
