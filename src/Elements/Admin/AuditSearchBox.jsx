import { AUDIT_SEARCH_EXAMPLES } from "../../utils/auditSearch";

const TIPS = [
  ["table 3 cash today", "every word must match"],
  ['"end session"', "these words together"],
  ["-cancelled", "leave these out"],
  ["staff:employee  type:sale  customer:juan  ref:1234", "only that staff, kind, customer or reference"],
  [">500  <100  ₱200", "an amount over, under or exactly"],
  ["today  yesterday  this week  last month  last 7 days", "a stretch of days"],
  ["oct 28  10/28  2026-10-28  october", "a day or a month"],
];

/**
 * The Audit Trail's search box: what to type, and once something is typed, how
 * it was read (`query.chips`, from utils/auditSearch.js) and how many events match.
 */
export default function AuditSearchBox({ value, onChange, query, count }) {
  return (
    <div className="audit-search">
      <div className="audit-search-field">
        <i className="bi bi-search" aria-hidden="true"></i>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search anything: a name, table, amount, reference or day (e.g. table 3 cash today)"
          aria-label="Search the audit trail"
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button type="button" className="audit-search-clear" onClick={() => onChange("")} aria-label="Clear search">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        )}
      </div>

      {value.trim() ? (
        <div className="audit-search-read" aria-live="polite">
          <span className={`audit-search-count${count ? "" : " is-none"}`}>
            {count} {count === 1 ? "match" : "matches"}
          </span>
          {query.chips.map((chip, index) => (
            <span key={`${chip.kind}-${index}`} className={`audit-search-chip is-${chip.kind}`}>
              <i className={`bi ${chip.icon}`} aria-hidden="true"></i>
              {chip.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="audit-search-examples">
          <span>Try:</span>
          {AUDIT_SEARCH_EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => onChange(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      <details className="audit-search-help">
        <summary>Search tips</summary>
        <dl>
          {TIPS.map(([example, meaning]) => (
            <div key={example}>
              <dt>
                <code>{example}</code>
              </dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
        <p>
          It also finds longer forms (&ldquo;cancel&rdquo; finds cancelled), other words for the same thing (&ldquo;gcash&rdquo;
          finds e-wallet, &ldquo;walkin&rdquo; finds walk-in) and a longer word with one letter off.
        </p>
      </details>
    </div>
  );
}
