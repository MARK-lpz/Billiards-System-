export const RESERVATIONS_PAGE_SIZE = 10;

export const matchesSearch = (reservation, term) => {
  if (!term) return true;

  const haystack = [
    reservation?.customerName,
    reservation?.customer,
    reservation?.tableName,
    reservation?.tableId,
    reservation?.table,
    reservation?.date,
    reservation?.time,
    reservation?.status,
    reservation?.phone,
    reservation?.email,
    reservation?.notes,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};
