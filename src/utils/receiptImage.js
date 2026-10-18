/**
 * The GCash receipt screenshot a customer attaches on the website. It is
 * redrawn in the browser before it is sent: no bigger than RECEIPT_MAX_SIDE a
 * side (the reference stays readable), saved again as WebP or JPEG (which
 * drops the phone's details) and sent with the booking as a data URL. The
 * server checks it again (config/online_payments.php).
 */
const RECEIPT_MAX_SIDE = 1800;
const RECEIPT_MIN_SIDE = 200;
// The server takes up to 3 MB; a screenshot is usually well under 1 MB.
const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Resolves with { dataUrl, width, height, size, name }; rejects with an Error
 * whose message is for the customer.
 */
export const prepareReceipt = async (file) => {
  if (!file || !String(file.type || "image/").startsWith("image/")) {
    throw new Error("Please attach a picture: a screenshot of your GCash receipt.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This picture could not be opened. Please attach a screenshot (JPG or PNG).");
  }
  if (Math.min(bitmap.width, bitmap.height) < RECEIPT_MIN_SIDE) {
    bitmap.close?.();
    throw new Error("This picture is too small to read. Please attach the full screenshot of your receipt.");
  }

  const scale = Math.min(1, RECEIPT_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  // White behind a picture with see-through parts, so the text stays readable.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let blob = await toBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (blob && blob.size > RECEIPT_MAX_BYTES) blob = await toBlob(canvas, "image/jpeg", 0.6);
  if (!blob || blob.size > RECEIPT_MAX_BYTES) {
    throw new Error("This picture is too large. Please attach a plain screenshot of your receipt.");
  }

  return { dataUrl: await readAsDataUrl(blob), width, height, size: blob.size, name: file.name || "receipt" };
};
