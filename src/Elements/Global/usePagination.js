import { useState } from "react";
import { PAGE_SIZE, paginate } from "../../utils/pagination";

export default function usePagination(items = [], size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
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
