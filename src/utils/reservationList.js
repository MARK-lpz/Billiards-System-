export const RESERVATIONS_PAGE_SIZE = 10;

export const paginate = (items = [], page = 1, size = RESERVATIONS_PAGE_SIZE) => {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const pageStart = (currentPage - 1) * size;

  return { pageCount, currentPage, pageStart, items: items.slice(pageStart, pageStart + size) };
};


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
