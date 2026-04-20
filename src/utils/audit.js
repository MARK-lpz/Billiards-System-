const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-CA");

export const createAuditEntry = ({
  id,
  timestamp,
  type = "other",
  staff = "System",
  action = "",
  detail = "",
  severity = "info",
  entity = "system",
  entityId = "",
  customer = null,
  table = null,
  reservation = null,
  payment = null,
  issue = null,
  extra = {},
}) => {
  const logTimestamp = timestamp || new Date().toISOString();
  const logDate = new Date(logTimestamp);

  return {
    id: id ?? Date.now() + Math.random(),
    timestamp: logTimestamp,
    date: dateFormatter.format(logDate),
    time: timeFormatter.format(logDate),
    type,
    staff,
    action,
    detail,
    severity,
    entity,
    entityId,
    customer,
    table,
    reservation,
    payment,
    issue,
    ...extra,
  };
};

export const appendAuditLog = (setLogs, entry) => {
  if (!setLogs) return;

  setLogs((prev) => [createAuditEntry(entry), ...prev]);
};

export const normalizeAuditLog = (log) => {
  if (!log) return null;

  if (log.timestamp) {
    return log;
  }

  return createAuditEntry({
    id: log.id,
    timestamp: log.date && log.time ? `${log.date}T${log.time}` : undefined,
    type: log.type || "other",
    staff: log.staff || "System",
    action: log.action || "",
    detail: log.detail || "",
    severity: log.severity || "info",
    entity: log.entity || log.type || "system",
    entityId: log.entityId || "",
    customer: log.customer || null,
    table: log.table || null,
    reservation: log.reservation || null,
    payment: log.payment || null,
    issue: log.issue || null,
    extra: Object.fromEntries(
      Object.entries(log).filter(
        ([key]) =>
          ![
            "id",
            "timestamp",
            "date",
            "time",
            "type",
            "staff",
            "action",
            "detail",
            "severity",
            "entity",
            "entityId",
            "customer",
            "table",
            "reservation",
            "payment",
            "issue",
          ].includes(key)
      )
    ),
  });
};

export const normalizeAuditLogs = (logs = []) =>
  Array.isArray(logs) ? logs.map(normalizeAuditLog).filter(Boolean) : [];
