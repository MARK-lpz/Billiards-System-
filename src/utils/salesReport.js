/**
 * One sales report for any period: a day, a month, a year or a range of dates
 * (From Feb 20, 2026 to Mar 20, 2026). The Reports page
 * shows its summary and the pop-up shows it in full as tables.
 */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PERIOD_TYPES = [
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "range", label: "Range" },
];

export const methodLabel = (method) => (method === "cash" ? "Cash" : method === "ewallet" ? "GCash" : method || "—");

export const formatPesoAmount = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime()) ? null : day;
};

const toDateKey = (day) => day.toLocaleDateString("en-CA");

const addDays = (date, days) => {
  const day = parseDay(date);
  day.setDate(day.getDate() + days);
  return toDateKey(day);
};

/** Days from `from` to `to`, counting both. */
export const countRangeDays = (from, to) => {
  const start = parseDay(from);
  const end = parseDay(to);
  return start && end ? Math.round((end - start) / 86400000) + 1 : 0;
};

/**
 * A range as staff entered it, made usable: missing ends filled from the
 * other, swapped if From comes after To, and never past today.
 */
export const normalizeRange = ({ from, to }, today) => {
  let start = from || to || today;
  let end = to || from || today;
  if (start > end) [start, end] = [end, start];
  if (end > today) end = today;
  if (start > end) start = end;
  return { from: start, to: end };
};

/** One-tap ranges, counted back from today. */
export const RANGE_PRESETS = [
  { key: "today", label: "Today", range: (today) => ({ from: today, to: today }) },
  { key: "yesterday", label: "Yesterday", range: (today) => ({ from: addDays(today, -1), to: addDays(today, -1) }) },
  { key: "last7", label: "Last 7 days", range: (today) => ({ from: addDays(today, -6), to: today }) },
  { key: "last30", label: "Last 30 days", range: (today) => ({ from: addDays(today, -29), to: today }) },
  { key: "thisMonth", label: "This month", range: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today }) },
  {
    key: "lastMonth",
    label: "Last month",
    range: (today) => {
      const lastDay = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    },
  },
  { key: "thisYear", label: "This year", range: (today) => ({ from: `${today.slice(0, 4)}-01-01`, to: today }) },
];

const shortDay = (date, withYear) =>
  parseDay(date)?.toLocaleDateString("en-PH", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }) || date;

/** "Feb 20 – Mar 20, 2026", or "Dec 20, 2025 – Jan 5, 2026" across years. */
const describeRange = (from, to) => {
  if (from === to) return shortDay(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${shortDay(from, !sameYear)} – ${shortDay(to, true)}`;
};

/** "Monday, October 5, 2026", "October 2026", "2026" or "Feb 20 – Mar 20, 2026". */
export const describePeriod = ({ type, date, month, year, from, to }) => {
  if (type === "range") return describeRange(from, to);
  if (type === "daily") {
    const day = parseDay(date);
    return day
      ? day.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : date || "";
  }
  if (type === "monthly") return `${MONTHS[Number(month) - 1] || ""} ${year}`.trim();
  return String(year);
};

const periodPrefix = ({ type, date, month, year }) =>
  type === "daily" ? date : type === "monthly" ? `${year}-${month}` : String(year);

const inPeriod = (date, period) => {
  if (period.type === "range") return date >= period.from && date <= period.to;
  return date.startsWith(periodPrefix(period));
};

/** The period's sales, oldest first, the way a report reads. */
export const getPeriodTransactions = (transactions = [], period) => {
  return transactions
    .filter((tx) => inPeriod(String(tx.date || "").slice(0, 10), period))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)) || Number(first.id) - Number(second.id));
};

const sumTotals = (transactions) => transactions.reduce((sum, tx) => sum + Number(tx.total || 0), 0);

const lineTotal = (item) => Number(item.price || 0) * Number(item.qty || 0);

/** Revenue, count, payment split, and how much came from table time versus items. */
export const summarizeSales = (transactions = []) => {
  const revenue = sumTotals(transactions);
  const tableTime = transactions.reduce(
    (sum, tx) => sum + (tx.items || []).filter((item) => item.isTableCharge).reduce((lines, item) => lines + lineTotal(item), 0),
    0
  );
  return {
    revenue,
    count: transactions.length,
    cash: sumTotals(transactions.filter((tx) => tx.method === "cash")),
    gcash: sumTotals(transactions.filter((tx) => tx.method === "ewallet")),
    tableTime,
    items: Math.max(0, revenue - tableTime),
    average: transactions.length ? revenue / transactions.length : 0,
  };
};

// A range up to about two months reads best day by day; longer ones by month.
const RANGE_DAILY_LIMIT = 62;

// Every month a range touches, "2025-12" to "2026-03".
const monthsInRange = (from, to) => {
  const months = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

/**
 * A month is broken down by day (only days with sales) and a year by month (all
 * twelve). A range goes by day when short and by month (every month it
 * touches) when long. A single day has no breakdown.
 */
export const getSalesBreakdown = (transactions = [], period) => {
  if (period.type === "daily") return null;
  if (period.type === "range" && period.from === period.to) return null;

  const byDay =
    period.type === "monthly" || (period.type === "range" && countRangeDays(period.from, period.to) <= RANGE_DAILY_LIMIT);

  const groups =
    byDay
      ? [...new Set(transactions.map((tx) => tx.date))].map((date) => ({
          key: date,
          label: parseDay(date)?.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) || date,
          transactions: transactions.filter((tx) => tx.date === date),
        }))
      : period.type === "range"
        ? monthsInRange(period.from, period.to).map((prefix) => ({
            key: prefix,
            label: `${MONTHS[Number(prefix.slice(5, 7)) - 1]} ${prefix.slice(0, 4)}`,
            transactions: transactions.filter((tx) => String(tx.date).startsWith(prefix)),
          }))
        : MONTHS.map((name, index) => {
            const prefix = `${period.year}-${String(index + 1).padStart(2, "0")}`;
            return { key: prefix, label: name, transactions: transactions.filter((tx) => String(tx.date).startsWith(prefix)) };
          });

  return {
    title: byDay ? "Daily Breakdown" : "Monthly Breakdown",
    firstColumn: byDay ? "Day" : "Month",
    rows: groups.map(({ key, label, transactions: group }) => ({ key, label, ...summarizeSales(group) })),
  };
};

/** "Daily", "Monthly", "Yearly" or "Date Range", for report titles. */
export const reportTypeLabel = (period) =>
  period.type === "range" ? "Date Range" : PERIOD_TYPES.find((entry) => entry.key === period.type)?.label || "";

/** "Table 1 · Table Time, Coca Cola ×2" */
export const describeItems = (tx) =>
  (tx.items || []).map((item) => (item.isTableCharge ? item.name : `${item.name} ×${item.qty}`)).join(", ");

export const receiptNumber = (tx) => `#${String(tx.id ?? "").slice(-5)}`;

/** The same report as a spreadsheet: summary, breakdown, then every sale. */
export const buildSalesReportRows = ({ period, transactions, summary, breakdown, generatedAt }) => [
  ["Break & Chill Billiard Hall"],
  [`${reportTypeLabel(period)} Sales Report`],
  ["Period", describePeriod(period)],
  ["Generated", generatedAt],
  [],
  ["Summary"],
  ["Revenue", Number(summary.revenue)],
  ["Transactions", summary.count],
  ["Cash", Number(summary.cash)],
  ["GCash", Number(summary.gcash)],
  ["Table time", Number(summary.tableTime)],
  ["Food & items", Number(summary.items)],
  ["Average sale", Number(summary.average.toFixed(2))],
  ...(breakdown
    ? [
        [],
        [breakdown.title],
        [breakdown.firstColumn, "Sales", "Cash", "GCash", "Total"],
        ...breakdown.rows.map((row) => [row.label, row.count, Number(row.cash), Number(row.gcash), Number(row.revenue)]),
        ["TOTAL", summary.count, Number(summary.cash), Number(summary.gcash), Number(summary.revenue)],
      ]
    : []),
  [],
  ["Transactions"],
  ["Date", "Time", "Receipt No.", "Cashier", "Items", "Paid by", "Reference No.", "Total"],
  ...transactions.map((tx) => [
    tx.date || "",
    tx.time || "",
    receiptNumber(tx),
    tx.cashier || "",
    describeItems(tx),
    methodLabel(tx.method),
    tx.paymentDetails?.referenceNumber || "",
    Number(tx.total || 0),
  ]),
  ["", "", "", "", "", "", "TOTAL", Number(summary.revenue)],
];
