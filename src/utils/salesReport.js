/**
 * One sales report for any period: a day, a month or a year. The Reports page
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
];

export const methodLabel = (method) => (method === "cash" ? "Cash" : method === "ewallet" ? "GCash" : method || "—");

export const formatPesoAmount = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseDay = (date) => {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime()) ? null : day;
};

/** "Monday, October 5, 2026", "October 2026" or "2026". */
export const describePeriod = ({ type, date, month, year }) => {
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

/** The period's sales, oldest first, the way a report reads. */
export const getPeriodTransactions = (transactions = [], period) => {
  const prefix = periodPrefix(period);
  return transactions
    .filter((tx) => String(tx.date || "").startsWith(prefix))
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

/**
 * A month is broken down by day (only days with sales) and a year by month (all
 * twelve). A single day has no breakdown.
 */
export const getSalesBreakdown = (transactions = [], period) => {
  if (period.type === "daily") return null;

  const groups =
    period.type === "monthly"
      ? [...new Set(transactions.map((tx) => tx.date))].map((date) => ({
          key: date,
          label: parseDay(date)?.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) || date,
          transactions: transactions.filter((tx) => tx.date === date),
        }))
      : MONTHS.map((name, index) => {
          const prefix = `${period.year}-${String(index + 1).padStart(2, "0")}`;
          return { key: prefix, label: name, transactions: transactions.filter((tx) => String(tx.date).startsWith(prefix)) };
        });

  return {
    title: period.type === "monthly" ? "Daily Breakdown" : "Monthly Breakdown",
    firstColumn: period.type === "monthly" ? "Day" : "Month",
    rows: groups.map(({ key, label, transactions: group }) => ({ key, label, ...summarizeSales(group) })),
  };
};

/** "Table 1 · Table Time, Coca Cola ×2" */
export const describeItems = (tx) =>
  (tx.items || []).map((item) => (item.isTableCharge ? item.name : `${item.name} ×${item.qty}`)).join(", ");

export const receiptNumber = (tx) => `#${String(tx.id ?? "").slice(-5)}`;

/** The same report as a spreadsheet: summary, breakdown, then every sale. */
export const buildSalesReportRows = ({ period, transactions, summary, breakdown, generatedAt }) => [
  ["Break & Chill Billiard Hall"],
  [`${PERIOD_TYPES.find((entry) => entry.key === period.type)?.label || ""} Sales Report`],
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
