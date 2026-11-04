const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `text` with each of `words` marked, ignoring case (a search's matches). */
export default function Highlight({ text, words = [] }) {
  const list = [...new Set(words.filter((word) => word && word.length >= 2))].sort((first, second) => second.length - first.length);
  if (!text || !list.length) return text ?? null;
  const parts = String(text).split(new RegExp(`(${list.map(escapeRegex).join("|")})`, "gi"));
  return parts.map((part, index) => (index % 2 ? <mark key={index} className="search-mark">{part}</mark> : part));
}
