const QR_API = (url, size) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=07080d&color=00c97a&margin=10&format=png`;

export default function QRDisplay({ url, qrSize, imgLoaded, onLoad }) {
  return (
    <div className="qr-display-wrapper">
      <div className="qr-display-box">
        <div className="qr-corner qr-corner-tl" />
        <div className="qr-corner qr-corner-tr" />
        <div className="qr-corner qr-corner-bl" />
        <div className="qr-corner qr-corner-br" />

        {!imgLoaded && (
          <div style={{ width: qrSize, height: qrSize }} className="shimmer" />
        )}
        <img
          key={url + qrSize}
          src={QR_API(url, qrSize * 2)}
          alt="Tournament QR Code"
          className="qr-glow"
          onLoad={onLoad}
          style={{
            width: qrSize,
            height: qrSize,
            display: imgLoaded ? "block" : "none",
          }}
        />
      </div>
    </div>
  );
}