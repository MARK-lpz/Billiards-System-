/**
 * Promo pictures and videos for tournaments. They are uploaded to the server
 * (api/event_media.php, kept in backend/Media) and each tournament keeps a list of them in `media`,
 * the first being its cover: shown on the website's slideshow and on the
 * Tournaments page.
 */
import { SESSION_ENDED_EVENT, apiFetch } from "./apiFetch";
import { getAuthToken } from "./session";
import { SITE_HOST, APP_API_BASE } from "./siteAddress";

const EVENT_API_BASE = import.meta.env.VITE_EVENT_API_URL
  ? import.meta.env.VITE_EVENT_API_URL.replace(/[^/]*$/, "")
  : !import.meta.env.DEV && window.location.hostname.endsWith(SITE_HOST)
    ? APP_API_BASE
    : "/api/";

const EVENT_MEDIA_API_URL = `${EVENT_API_BASE}event_media.php`;

export const EVENT_MEDIA_PER_EVENT = 8;

// What the app takes, by the file's type; the server checks the contents again.
export const EVENT_MEDIA_TYPES = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
};
export const EVENT_MEDIA_ACCEPT = Object.keys(EVENT_MEDIA_TYPES).join(",");

// Until the server says otherwise (it can only lower these).
export const DEFAULT_EVENT_MEDIA_LIMITS = { imageMaxBytes: 8 * 1024 * 1024, videoMaxBytes: 40 * 1024 * 1024, perEvent: 8 };

// Pictures larger than this on either side are scaled down before upload.
const IMAGE_MAX_SIDE = 1920;

// Files live in backend/Media; a tournament stores "Media/<name>".
const MEDIA_PREFIX = "Media/";
const PATH_PATTERN = /^Media\/[a-f0-9]{32}\.(jpg|png|webp|gif|mp4|webm)$/;

/** A tournament's usable media, in order (the first is the cover). */
export const getEventMedia = (event) =>
  (Array.isArray(event?.media) ? event.media : []).filter(
    (item) => item && PATH_PATTERN.test(String(item.path || "")) && (item.type === "image" || item.type === "video")
  );

/** The picture (or else video) that stands for a tournament on the website. */
export const getEventCover = (event) => getEventMedia(event)[0] || null;

/** Where a media file is served from: api/media.php, as Media/ is not under api/. */
export const eventMediaUrl = (item) =>
  `${EVENT_API_BASE}media.php?file=${encodeURIComponent(String(item.path).slice(MEDIA_PREFIX.length))}`;

export const formatMegabytes = (bytes) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

/** The type a picked file counts as ("image" or "video"), or null when it cannot be used. */
export const getMediaKind = (file) => {
  if (EVENT_MEDIA_TYPES[file?.type]) return EVENT_MEDIA_TYPES[file.type];
  // Some browsers leave the type blank: go by the name.
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) return "image";
  if (["mp4", "webm"].includes(extension)) return "video";
  return null;
};

export const fetchEventMediaLimits = async () => {
  const response = await apiFetch(EVENT_MEDIA_API_URL);
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "Unable to read the upload limits.");
  return { ...DEFAULT_EVENT_MEDIA_LIMITS, ...data.limits };
};

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * A picture ready to upload: scaled to at most 1920px a side and saved again,
 * which also drops the camera's details (such as where it was taken). GIFs are
 * kept as they are so they still move.
 */
export const prepareImage = async (file) => {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // The server says so if it truly cannot be read.
  }

  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // WebP keeps transparency; a browser that cannot write it gets a JPEG on the site's dark background.
  let blob = await toBlob(canvas, "image/webp", 0.86);
  if (!blob || blob.type !== "image/webp") {
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#0b0d0c";
    context.fillRect(0, 0, width, height);
    blob = await toBlob(canvas, "image/jpeg", 0.86);
  }
  if (!blob || (blob.size >= file.size && scale === 1)) return file;

  const name = `${String(file.name || "picture").replace(/\.[^.]+$/, "")}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
  return new File([blob], name, { type: blob.type });
};

/**
 * Uploads one file, reporting progress (0-100). Resolves with the saved media
 * ({ id, path, type, width?, height? }); rejects with a message to show.
 * Returns { promise, abort }.
 */
export const uploadEventMedia = (file, onProgress) => {
  const request = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    request.open("POST", EVENT_MEDIA_API_URL);
    const token = getAuthToken();
    if (token) request.setRequestHeader("X-Auth-Token", token);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let data = null;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        data = null;
      }
      if (request.status === 401 && token) window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
      if (request.status >= 200 && request.status < 300 && data?.success && data.media) resolve(data.media);
      else if (request.status === 413) reject(new Error(data?.message || "This file is larger than the server accepts."));
      else reject(new Error(data?.message || "The upload did not finish. Please try again."));
    };
    request.onerror = () => reject(new Error("Couldn't reach the server. Check the connection and try again."));
    request.onabort = () => reject(new Error("Upload stopped."));

    const body = new FormData();
    body.append("file", file, file.name);
    request.send(body);
  });
  return { promise, abort: () => request.abort() };
};
