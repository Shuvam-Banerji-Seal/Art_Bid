import { useState, useEffect } from 'react';

export default function CountdownTimer({ targetDate, label = '' }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0
        ? `${d}d ${h}h ${m}m`
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return (
    <span style={{ fontFamily: 'Cormorant Garamond', fontSize: 20, color: 'var(--accent-warm)' }}>
      {label && (
        <span style={{ fontSize: 13, fontFamily: 'DM Sans', color: 'var(--text-muted)', marginRight: 8 }}>
          {label}
        </span>
      )}
      {timeLeft}
    </span>
  );
}
