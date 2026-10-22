/**
 * A staff member's profile picture, redrawn in the browser before it is sent:
 * the middle square of the picture, PHOTO_SIDE pixels a side, saved again as
 * WebP or JPEG (which also drops the camera's details). The server checks it
 * again (backend/api/profile.php).
 */
const PHOTO_SIDE = 320;
const PHOTO_MIN_SIDE = 64;

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Resolves with the picture as a data URL; rejects with an Error whose message is for the user. */
export const preparePhoto = async (file) => {
  if (!file || !String(file.type || "image/").startsWith("image/")) {
    throw new Error("Choose a picture (JPG, PNG or WebP).");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This picture could not be opened. Choose a JPG, PNG or WebP picture.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  if (side < PHOTO_MIN_SIDE) {
    bitmap.close?.();
    throw new Error("This picture is too small. Choose a clearer one.");
  }

  const size = Math.min(PHOTO_SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  // White behind a picture with see-through parts.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();

  let blob = await toBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("This picture could not be prepared. Try another one.");
  return readAsDataUrl(blob);
};

/** Up to two letters for the picture's place when there is none: "Juan Dela Cruz" -> "JC". */
export const initialsOf = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0] || "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
};
