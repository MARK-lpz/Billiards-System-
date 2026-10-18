import { formatRegisteredAt } from "./tournamentRegistrations";

// When a notice came in: the database's own time in ms (createdAtMs), right
// whatever time zone the hosting keeps; else its createdAt as written.
export const noticeTime = (notice) => {
  const at = Number(notice.createdAtMs);
  if (at > 0) return formatRegisteredAt(new Date(at).toISOString());
  return notice.createdAt ? formatRegisteredAt(notice.createdAt) : "";
};
