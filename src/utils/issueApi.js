import { apiFetch } from "./apiFetch";
const ISSUE_API_URL = import.meta.env.VITE_ISSUE_API_URL || (
  !import.meta.env.DEV && window.location.hostname.endsWith('breakandchill.com')
    ? 'https://app.breakandchill.com/api/issues.php'
    : '/api/issues.php'
);

const parseResponse = async (response) => {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to update the issue feed.');
  }
  return data;
};

export const createRemoteIssue = async (issue) => {
  const response = await apiFetch(ISSUE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
  return parseResponse(response);
};

// `resolvedBy` is kept with the report, so the history shows who closed it.
export const resolveRemoteIssue = async (id, resolvedBy = '') => {
  const response = await apiFetch(ISSUE_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, resolvedBy }),
  });
  return parseResponse(response);
};

/**
 * One page of Report History from the server: resolved reports, latest
 * resolved first, for one table or one kind of report if asked. Resolves to
 * { issues, total, page, perPage, pageCount, groupCounts, types }.
 */
export const fetchResolvedIssues = async ({ page = 1, perPage = 15, tableId = '', type = '' } = {}) => {
  const params = new URLSearchParams({ status: 'resolved', page: String(page), perPage: String(perPage) });
  if (tableId !== '' && tableId !== null && tableId !== undefined) params.set('tableId', String(tableId));
  if (type) params.set('type', type);
  const response = await apiFetch(`${ISSUE_API_URL}?${params}`);
  const data = await parseResponse(response);
  return {
    issues: Array.isArray(data.issues) ? data.issues : [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    perPage: Number(data.perPage) || perPage,
    pageCount: Number(data.pageCount) || 1,
    groupCounts: data.groupCounts && typeof data.groupCounts === 'object' ? data.groupCounts : {},
    types: Array.isArray(data.types) ? data.types : [],
  };
};

export const fetchRemoteIssues = async () => {
  const response = await apiFetch(ISSUE_API_URL);
  const data = await parseResponse(response);
  return Array.isArray(data.issues) ? data.issues : [];
};
