import { useEffect, useState } from 'react';
import '../../styles/LoadingBar.css';

export default function LoadingBar({ loading }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } else {
      // Delay hiding to show completion animation
      setTimeout(() => setVisible(false), 300);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className={`loading-bar ${!loading ? 'complete' : ''}`}>
      <div className="loading-bar-progress"></div>
    </div>
  );
}