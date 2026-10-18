import { useEffect, useState } from "react";
import "../../styles/OnlinePayments.css";
import { fetchReceiptUrl } from "../../utils/paymentsApi";

/**
 * The receipt screenshot a customer sent with a GCash payment. The server
 * gives it to signed-in staff only, so it is fetched with the sign-in and shown
 * from this page's own copy, which is dropped when the picture closes. Tapping
 * it shows it full size.
 */
export default function ReceiptImage({ payment }) {
  const id = payment?.id || "";
  const kept = Boolean(payment?.hasReceipt);
  // { status: "loading" | "ready" | "missing" | "error", url, for: the payment and try it belongs to }
  const [shown, setShown] = useState({ status: "loading", url: "", for: "" });
  const [attempt, setAttempt] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const key = `${id}:${attempt}`;

  useEffect(() => {
    if (!id || !kept) return undefined;
    let active = true;
    let url = "";
    fetchReceiptUrl(id)
      .then((objectUrl) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        url = objectUrl;
        setShown({ status: "ready", url: objectUrl, for: key });
      })
      .catch((error) => {
        if (active) setShown({ status: error.status === 404 ? "missing" : "error", url: "", for: key });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, kept, key]);

  useEffect(() => {
    if (!zoomed) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setZoomed(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [zoomed]);

  // A picture from an earlier payment or try is never shown for this one.
  const status = !kept ? "missing" : shown.for === key ? shown.status : "loading";

  return (
    <figure className="pay-receipt">
      <span className="pay-receipt-label">Receipt from the customer</span>
      {status === "loading" && (
        <div className="pay-receipt-box" role="status">
          <i className="bi bi-hourglass-split" aria-hidden="true"></i> Loading the receipt…
        </div>
      )}
      {status === "missing" && (
        <div className="pay-receipt-box">
          <i className="bi bi-image" aria-hidden="true"></i>
          No receipt is kept for this payment. Receipts are deleted 30 days after the booking or tournament day.
        </div>
      )}
      {status === "error" && (
        <div className="pay-receipt-box is-error" role="alert">
          <i className="bi bi-wifi-off" aria-hidden="true"></i>
          Couldn&apos;t load the receipt.
          <button type="button" className="pay-receipt-retry" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {status === "ready" && (
        <>
          <button type="button" className="pay-receipt-thumb" onClick={() => setZoomed(true)} aria-label="Show the receipt full size">
            <img src={shown.url} alt={`GCash receipt sent by ${payment.customerName}`} />
          </button>
          <figcaption>Tap the receipt to see it full size.</figcaption>
        </>
      )}

      {zoomed && status === "ready" && (
        <div className="pay-receipt-zoom" role="dialog" aria-modal="true" aria-label="Receipt, full size" onClick={() => setZoomed(false)}>
          <img src={shown.url} alt={`GCash receipt sent by ${payment.customerName}, full size`} />
          <button type="button" className="pay-receipt-zoom-close" onClick={() => setZoomed(false)}>
            <i className="bi bi-x-lg" aria-hidden="true"></i> Close
          </button>
        </div>
      )}
    </figure>
  );
}
