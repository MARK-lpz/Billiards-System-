import { useState } from "react";
import "../../styles/Guest/Qr/Qrbase.css";
import "../../styles/Guest/Qr/QrHeader.css";
import "../../styles/Guest/Qr/QrDisplay.css";
import "../../styles/Guest/Qr/QrControls.css";
import "../../styles/Guest/Qr/QrActions.css";
import QRDisplay from "../../Elements/Guest/QRDisplay";
import QRSizeSelector from "../../Elements/Guest/QRSizeSelector";
import QRURLInput from "../../Elements/Guest/QRurl";
import QRActions from "../../Elements/Guest/QRActions";

export default function QRGenerator() {
  const [url, setUrl] = useState("http://localhost:3000/tournament-form");
  const [inputVal, setInputVal] = useState("http://localhost:3000/tournament-form");
  const [qrSize, setQrSize] = useState(280);
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleApply = () => {
    setImgLoaded(false);
    setUrl(inputVal);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSizeChange = (size) => {
    setQrSize(size);
    setImgLoaded(false);
  };

  return (
    <div className="qr-container">
      <div className="qr-wrapper">
        {/* Header */}

        {/* Card */}
        <div className="qr-card ">
          <div className="qr-card-top-line" />

          <QRDisplay 
            url={url} 
            qrSize={qrSize} 
            imgLoaded={imgLoaded} 
            onLoad={() => setImgLoaded(true)} 
          />

          <p className="qr-scan-label">
            <i className="bi bi-phone" style={{ marginRight: 6 }}></i>
            Scan to Register
          </p>

          <QRSizeSelector qrSize={qrSize} onSizeChange={handleSizeChange} />
          <QRURLInput inputVal={inputVal} onInputChange={setInputVal} onApply={handleApply} />
          <QRActions url={url} copied={copied} onCopy={handleCopy} />
        </div>
      </div>
    </div>
  );
}