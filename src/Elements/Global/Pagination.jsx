import "../../styles/Pagination.css";


export default function Pagination({ page, pageCount, pageStart, pageSize, total, goToPage }) {
  if (!total) return null;

  return (
    <div className="list-pagination">
      <span className="list-pagination-count">
        Showing {pageStart + 1}
        &ndash;{Math.min(pageStart + pageSize, total)}
        {" "}of {total}
      </span>

      <div className="list-pagination-controls">
        <button
          type="button"
          className="list-page-btn"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
        >
          <i className="bi bi-chevron-left"></i>
          Previous
        </button>

        <span className="list-page-indicator">
          Page {page} of {pageCount}
        </span>

        <button
          type="button"
          className="list-page-btn"
          onClick={() => goToPage(page + 1)}
          disabled={page >= pageCount}
        >
          Next
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
}
