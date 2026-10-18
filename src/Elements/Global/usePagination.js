import { useState } from "react";
import { PAGE_SIZE, paginate } from "../../utils/pagination";

// `initialPage`: where the list opens, e.g. the page holding a row to show.
// `resetKey`: when it changes (another period or day picked), the list opens on
// page 1 again.
export default function usePagination(items = [], size = PAGE_SIZE, initialPage = 1, resetKey = null) {
  const [state, setState] = useState({ page: initialPage, key: resetKey });
  const page = state.key === resetKey ? state.page : 1;
  const { pageCount, currentPage, pageStart, items: pageItems } = paginate(items, page, size);

  return {
    items: pageItems,
    page: currentPage,
    pageCount,
    pageStart,
    pageSize: size,
    total: items.length,
    goToPage: (nextPage) => setState({ page: Math.min(Math.max(1, nextPage), pageCount), key: resetKey }),
  };
}
