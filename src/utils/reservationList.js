export const RESERVATIONS_PAGE_SIZE = 10;

// Page is clamped rather than corrected in an effect, so the list stays valid
// even when rows disappear from underneath the page being viewed.
export const paginate = (items = [], page = 1, size = RESERVATIONS_PAGE_SIZE) => {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const pageStart = (currentPage - 1) * size;

  return { pageCount, currentPage, pageStart, items: items.slice(pageStart, pageStart + size) };
};

// Every word in the term has to appear somewhere in the row, so "juan approved"
// narrows the list instead of widening it.
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
