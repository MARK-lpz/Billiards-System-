import { formatRegisteredAt } from "./tournamentRegistrations";

// When a notice came in: the server's time, or the time at the start of a local notice's id.
export const noticeTime = (notice) => {
  if (notice.createdAt) return formatRegisteredAt(notice.createdAt);
  const stamp = Number(String(notice.id).split("-")[0]);
  return stamp ? formatRegisteredAt(new Date(stamp).toISOString()) : "";
};
