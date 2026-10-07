// How many rows or cards a paged list shows at a time.
export const PAGE_SIZE = 10;

export const paginate = (items = [], page = 1, size = PAGE_SIZE) => {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const pageStart = (currentPage - 1) * size;

  return { pageCount, currentPage, pageStart, items: items.slice(pageStart, pageStart + size) };
};
