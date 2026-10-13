import { useState } from "react";
import { PAGE_SIZE, paginate } from "../../utils/pagination";

// `initialPage`: where the list opens, e.g. the page holding a row to show.
export default function usePagination(items = [], size = PAGE_SIZE, initialPage = 1) {
  const [page, setPage] = useState(initialPage);
  const { pageCount, currentPage, pageStart, items: pageItems } = paginate(items, page, size);

  return {
    items: pageItems,
    page: currentPage,
    pageCount,
    pageStart,
    pageSize: size,
    total: items.length,
    goToPage: (nextPage) => setPage(Math.min(Math.max(1, nextPage), pageCount)),
  };
}
