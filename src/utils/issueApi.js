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
  const response = await fetch(ISSUE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
  return parseResponse(response);
};

export const resolveRemoteIssue = async (id) => {
  const response = await fetch(ISSUE_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return parseResponse(response);
};

export const fetchRemoteIssues = async () => {
  const response = await fetch(ISSUE_API_URL);
  const data = await parseResponse(response);
  return Array.isArray(data.issues) ? data.issues : [];
};
