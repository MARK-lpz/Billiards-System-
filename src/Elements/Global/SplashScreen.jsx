import "../../styles/SplashScreen.css";

export default function SplashScreen({ leaving = false }) {
  return (
    <div className={`splash-screen ${leaving ? "is-leaving" : ""}`} role="status" aria-label="Loading Break & Chill">
      <img src="/Logo.png" alt="" className="splash-logo" />
    </div>
  );
}
