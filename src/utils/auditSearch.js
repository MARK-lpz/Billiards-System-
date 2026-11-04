/**
 * The Audit Trail's search, read the way staff type it:
 *
 *   cash table 3 today         every word must match the event
 *   "end session"              these words together
 *   -cancelled                 leave these out
 *   staff:employee type:sale   only that staff / kind (also customer:, ref:, table:, date:, level:)
 *   >500  <100  over 500  ₱200 an amount over, under or exactly
 *   today  yesterday  this week  last week  this month  last month  last 7 days
 *   oct 28  28 oct  10/28  2026-10-28  october
 *
 * A word matches any part of the event: who, what, the detail, the customer,
 * the table, the payment and its reference, the day and the time. It also
 * finds a word's longer form ("cancel" finds "cancelled"), the other words
 * staff use for the same thing ("gcash" finds e-wallet payments), and a
 * longer word with one letter off ("reservaton").
 */
import { auditLevel, auditTypeLabel } from "./auditReport";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_WORD = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

// Words staff use for the same thing; any of them is a match.
const SAME_AS = [
  ["gcash", "ewallet", "e-wallet", "e wallet"],
  ["walkin", "walk-in", "walk in"],
  ["login", "signin", "signed in", "logged in", "log in", "sign in"],
  ["logout", "signout", "signed out", "logged out", "log out", "sign out"],
  ["refund", "refunded", "sent back", "given back"],
  ["booking", "booked", "reservation"],
  ["sale", "sold", "paid", "payment"],
  ["delete", "deleted", "removed", "remove"],
  ["noshow", "no-show", "no show", "expired"],
  ["checkin", "check-in", "checked in", "check in"],
];
const SYNONYMS = new Map();
SAME_AS.forEach((group) => group.forEach((word) => SYNONYMS.set(word.replace(/[^a-z0-9]/g, ""), group)));

const FIELD_KEYS = {
  staff: "staff",
  by: "staff",
  type: "type",
  kind: "type",
  customer: "customer",
  ref: "ref",
  reference: "ref",
  table: "table",
  date: "date",
  level: "level",
  severity: "level",
};

// Kept out of the words: ids and big blobs (a receipt picture).
const SKIP_KEYS = new Set(["id", "timestamp", "dataUrl", "receipt", "media", "qr"]);

export const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/₱/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pad = (number) => String(number).padStart(2, "0");
const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const monthIndex = (word) => MONTHS.indexOf(word.slice(0, 3));

const formatDay = (iso) => {
  const day = new Date(`${iso}T00:00:00`);
  return day.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

// A month and day typed without a year: this year's, or last year's if that is still ahead.
const pastDay = (month, day, year, today) => {
  if (year) return new Date(year, month, day);
  const thisYear = new Date(today.getFullYear(), month, day);
  return thisYear > today ? new Date(today.getFullYear() - 1, month, day) : thisYear;
};

// ── Each event's words, built once ───────────────────────────────────
const cache = new WeakMap();

const collect = (value, out, depth = 0) => {
  if (value == null || depth > 3) return;
  if (typeof value === "string") {
    if (value.length <= 400) out.push(value);
  } else if (typeof value === "number") {
    out.push(String(value), value.toFixed(2));
  } else if (Array.isArray(value)) {
    value.forEach((item) => collect(item, out, depth + 1));
  } else if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (!SKIP_KEYS.has(key)) collect(item, out, depth + 1);
    });
  }
};

const amountsIn = (log) => {
  const amounts = [];
  const payment = log.payment || {};
  ["total", "amount", "subtotal", "amountDue"].forEach((key) => {
    if (Number.isFinite(Number(payment[key])) && payment[key] !== null && payment[key] !== "") amounts.push(Number(payment[key]));
  });
  if (Number.isFinite(Number(log.amount)) && log.amount !== null && log.amount !== "") amounts.push(Number(log.amount));
  `${log.action || ""} ${log.detail || ""}`.replace(/₱\s?([\d,]+(?:\.\d+)?)/g, (_, digits) => {
    amounts.push(Number(digits.replace(/,/g, "")));
    return "";
  });
  return amounts;
};

const indexLog = (log) => {
  if (cache.has(log)) return cache.get(log);
  const parts = [];
  collect(log, parts);
  const day = String(log.date || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const date = new Date(`${day}T00:00:00`);
    parts.push(
      formatDay(day),
      date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })
    );
  }
  if (log.time) {
    const clock = new Date(`2000-01-01T${String(log.time).slice(0, 8)}`);
    if (!Number.isNaN(clock.getTime())) parts.push(clock.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }));
  }
  parts.push(auditTypeLabel(log.type), auditLevel(log));
  const text = normalizeText(parts.join(" | "));
  const entry = {
    text,
    words: [...new Set(text.split(/[^a-z0-9-]+/).filter((word) => word.length >= 4))],
    amounts: amountsIn(log),
  };
  cache.set(log, entry);
  return entry;
};

// ── Matching ─────────────────────────────────────────────────────────
// Whether two words differ by at most one letter (added, dropped or changed).
const nearlySame = (first, second) => {
  if (Math.abs(first.length - second.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < first.length && j < second.length) {
    if (first[i] === second[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (first.length > second.length) i += 1;
    else if (second.length > first.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (first.length - i) + (second.length - j) <= 1;
};

const alternativesOf = (term) => SYNONYMS.get(term.replace(/[^a-z0-9]/g, "")) || [term];

const matchesTerm = (index, term) =>
  alternativesOf(term).some((alt) => {
    // A number stands alone: "200" finds ₱200.00 but not ₱1200.
    if (/^\d+(\.\d+)?$/.test(alt)) return new RegExp(`(^|[^\\d.])${escapeRegex(alt)}(?![\\d])`).test(index.text);
    if (index.text.includes(alt)) return true;
    // One letter off, in words of 5 or more that start the same ("gcash" is not "cash").
    return (
      alt.length >= 5 &&
      !alt.includes(" ") &&
      index.words.some((word) => word.length >= 5 && word[0] === alt[0] && nearlySame(word, alt))
    );
  });

const matchesTable = (log, index, table) => {
  if (/^\d+$/.test(table)) return new RegExp(`\\btable ${table}\\b`).test(index.text);
  return normalizeText(log.table?.name || "").includes(table) || index.text.includes(table);
};

const fieldText = {
  staff: (log) => normalizeText([log.staff, log.username, log.by].filter(Boolean).join(" ")),
  type: (log) => normalizeText(`${log.type} ${auditTypeLabel(log.type)} ${log.entity || ""}`),
  customer: (log) =>
    normalizeText(
      [
        log.customer?.previous?.name,
        log.customer?.current?.name,
        log.customer?.name,
        log.reservation?.customerName,
        log.customerName,
      ]
        .filter(Boolean)
        .join(" ")
    ),
  ref: (log) =>
    normalizeText(
      [log.payment?.referenceNumber, log.payment?.reference, log.reference, log.reservation?.paymentReference].filter(Boolean).join(" ")
    ),
  level: (log) => normalizeText(auditLevel(log)),
};

const amountMatches = (amounts, { op, value }) =>
  amounts.some((amount) => {
    if (op === ">") return amount > value;
    if (op === ">=") return amount >= value;
    if (op === "<") return amount < value;
    if (op === "<=") return amount <= value;
    return Math.abs(amount - value) < 0.005;
  });

// ── Reading what was typed ───────────────────────────────────────────
const peso = (value) => `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/**
 * What the search box says, read into { terms, excludes, fields, table,
 * dates: { from, to, label }, amount: { op, value }, chips, empty }. `chips`
 * say back how it was read; `highlight` are the words to mark in the results.
 */
export const parseAuditQuery = (input, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let text = ` ${String(input || "").toLowerCase().replace(/[“”]/g, '"')} `;
  const query = { terms: [], excludes: [], fields: {}, table: "", dates: null, amount: null, chips: [], highlight: [] };
  const take = (pattern, use) => {
    text = text.replace(pattern, (...match) => {
      use(match);
      return " ";
    });
  };
  const setDates = (from, to, label) => {
    query.dates = { from: isoDay(from), to: isoDay(to), label };
  };

  // Days, in words first.
  take(/\btoday\b/, () => setDates(today, today, "Today"));
  take(/\byesterday\b/, () => setDates(addDays(today, -1), addDays(today, -1), "Yesterday"));
  take(/\b(?:last|past) (\d{1,3}) days\b/, ([, days]) =>
    setDates(addDays(today, -(Number(days) - 1)), today, `Last ${Number(days)} days`)
  );
  take(/\bthis week\b/, () => setDates(addDays(today, -((today.getDay() + 6) % 7)), today, "This week"));
  take(/\blast week\b/, () => {
    const monday = addDays(today, -((today.getDay() + 6) % 7) - 7);
    setDates(monday, addDays(monday, 6), "Last week");
  });
  take(/\bthis month\b/, () => setDates(new Date(today.getFullYear(), today.getMonth(), 1), today, "This month"));
  take(/\blast month\b/, () =>
    setDates(new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0), "Last month")
  );
  take(/\b(?:date:)?(\d{4})-(\d{1,2})-(\d{1,2})\b/, ([, year, month, day]) => {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    setDates(date, date, formatDay(isoDay(date)));
  });
  take(new RegExp(`\\b${MONTH_WORD} (\\d{1,2})(?:,? (\\d{4}))?\\b`), ([, month, day, year]) => {
    const date = pastDay(monthIndex(month), Number(day), Number(year) || 0, today);
    setDates(date, date, formatDay(isoDay(date)));
  });
  take(new RegExp(`\\b(\\d{1,2}) ${MONTH_WORD}(?: (\\d{4}))?\\b`), ([, day, month, year]) => {
    const date = pastDay(monthIndex(month), Number(day), Number(year) || 0, today);
    setDates(date, date, formatDay(isoDay(date)));
  });
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/, ([, month, day, year]) => {
    const date = pastDay(Number(month) - 1, Number(day), Number(year) || 0, today);
    setDates(date, date, formatDay(isoDay(date)));
  });
  // A month alone ("may" alone is too common a word to be one).
  take(/\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?: (\d{4}))?/, ([, month, year]) => {
    const index = monthIndex(month);
    const thisYear = new Date(today.getFullYear(), index, 1);
    const start = year ? new Date(Number(year), index, 1) : thisYear > today ? new Date(today.getFullYear() - 1, index, 1) : thisYear;
    setDates(start, new Date(start.getFullYear(), index + 1, 0), `${MONTH_NAMES[index].replace(/^./, (c) => c.toUpperCase())} ${start.getFullYear()}`);
  });

  // Amounts.
  take(/(>=|<=|>|<)\s*₱?\s*([\d,]+(?:\.\d+)?)/, ([, op, value]) => {
    query.amount = { op, value: Number(value.replace(/,/g, "")) };
  });
  take(/\b(over|above|more than|under|below|less than)\s+₱?\s*([\d,]+(?:\.\d+)?)/, ([, word, value]) => {
    query.amount = { op: /over|above|more/.test(word) ? ">" : "<", value: Number(value.replace(/,/g, "")) };
  });
  take(/₱\s*([\d,]+(?:\.\d+)?)/, ([, value]) => {
    query.amount = { op: "=", value: Number(value.replace(/,/g, "")) };
  });

  // Tables: "table 3", "table3", "t3", "table:vip".
  take(/\btable:\s*("([^"]+)"|\S+)/, ([, raw, quoted]) => {
    query.table = normalizeText(quoted || raw);
  });
  take(/\b(?:table\s*|t)(\d{1,3})\b/, ([, number]) => {
    query.table = String(Number(number));
  });

  // Fields: staff:ella, type:sale, customer:"juan cruz".
  take(/\b([a-z]+):\s*("([^"]+)"|\S+)/, ([whole, key, raw, quoted]) => {
    const field = FIELD_KEYS[key];
    if (field && field !== "table" && field !== "date") query.fields[field] = normalizeText(quoted || raw);
    else if (!field) query.terms.push(normalizeText(whole.replace(/:/g, " ")));
  });

  // Words left: "phrases", -left out, the rest.
  take(/(-?)"([^"]+)"/, ([, minus, phrase]) => {
    (minus ? query.excludes : query.terms).push(normalizeText(phrase));
  });
  text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .forEach((word) => {
      if (word.startsWith("-") && word.length > 1) query.excludes.push(normalizeText(word.slice(1)));
      else {
        const term = normalizeText(word);
        if (term) query.terms.push(term);
      }
    });

  // What the box understood, said back.
  if (query.dates) query.chips.push({ kind: "date", icon: "bi-calendar3", label: query.dates.label });
  if (query.table) query.chips.push({ kind: "table", icon: "bi-grid-3x3-gap", label: /^\d+$/.test(query.table) ? `Table ${query.table}` : `Table: ${query.table}` });
  if (query.amount) {
    const { op, value } = query.amount;
    const label = op === "=" ? peso(value) : `${op.startsWith(">") ? "Over" : "Under"} ${peso(value)}`;
    query.chips.push({ kind: "amount", icon: "bi-cash", label });
  }
  Object.entries(query.fields).forEach(([field, value]) =>
    query.chips.push({ kind: "field", icon: "bi-funnel", label: `${field.charAt(0).toUpperCase() + field.slice(1)}: ${value}` })
  );
  query.terms.forEach((term) => {
    const alternatives = alternativesOf(term).filter((alt) => alt !== term);
    query.chips.push({
      kind: "word",
      icon: "bi-search",
      label: alternatives.length ? `${term} (also ${alternatives.slice(0, 2).join(", ")})` : term,
    });
  });
  query.excludes.forEach((term) => query.chips.push({ kind: "exclude", icon: "bi-dash-circle", label: `Not: ${term}` }));

  query.highlight = [
    ...query.terms.flatMap(alternativesOf),
    ...Object.values(query.fields),
    ...(query.table ? [/^\d+$/.test(query.table) ? `table ${query.table}` : query.table] : []),
  ].filter((word) => word && !/^\d{1,2}$/.test(word));
  query.empty = !query.dates && !query.table && !query.amount && !Object.keys(query.fields).length && !query.terms.length && !query.excludes.length;
  return query;
};

/** The events that match the search, in the order given. */
export const searchAuditLogs = (logs = [], query) => {
  if (!query || query.empty) return logs;
  return logs.filter((log) => {
    const index = indexLog(log);
    if (query.dates) {
      const day = String(log.date || "").slice(0, 10);
      if (day < query.dates.from || day > query.dates.to) return false;
    }
    if (query.table && !matchesTable(log, index, query.table)) return false;
    if (query.amount && !amountMatches(index.amounts, query.amount)) return false;
    for (const [field, value] of Object.entries(query.fields)) {
      const own = fieldText[field]?.(log) || "";
      if (!own.includes(value) && !(field === "type" && own.includes(value.replace(/s$/, "")))) return false;
    }
    if (!query.terms.every((term) => matchesTerm(index, term))) return false;
    return !query.excludes.some((term) => matchesTerm(index, term));
  });
};

/** A few searches to start from, shown under an empty box. */
export const AUDIT_SEARCH_EXAMPLES = ["today", "table 1", "gcash", "cancelled", "staff:employee", ">500", "last 7 days"];
