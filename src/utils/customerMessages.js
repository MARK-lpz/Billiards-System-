const peso = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const buildReservationMessage = ({ customerName, tableName, date, time, total, reference }) =>
  [
    `Hi ${customerName || "there"}, Break & Chill received your table reservation.`,
    `${tableName} on ${date} at ${time}.`,
    `GCash ${peso(total)} paid, reference ${reference}.`,
    "We will text you again once the staff confirm it. Please show this message when you arrive.",
  ].join(" ");

export const buildTournamentMessage = ({ customerName, eventName, date, time, total, reference }) =>
  [
    `Hi ${customerName || "there"}, Break & Chill received your tournament registration.`,
    `${eventName}${date ? ` on ${date}` : ""}${time ? ` at ${time}` : ""}.`,
    Number(total) > 0
      ? `GCash ${peso(total)} paid, reference ${reference}.`
      : "No entry fee for this tournament.",
    "We will text you again once your slot is confirmed. Please show this message when you arrive.",
  ].join(" ");
