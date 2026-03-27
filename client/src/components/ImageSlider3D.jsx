import { useMemo, useState } from 'react';
import anime from 'animejs/lib/anime.es.js';

export default function ImageSlider3D({ images = [] }) {
  const [index, setIndex] = useState(0);

  const safeImages = useMemo(() => images.filter(Boolean), [images]);

  const go = (next) => {
    const root = document.querySelector('.image-slider-3d-stage');
    if (root) {
      anime({
        targets: root,
        rotateY: ['0deg', next > index ? '-12deg' : '12deg', '0deg'],
        duration: 460,
        easing: 'easeOutCubic',
      });
    }
    setIndex((next + safeImages.length) % safeImages.length);
  };

  if (!safeImages.length) {
    return (
      <div style={{ height: 460, borderRadius: 14, background: 'var(--bg-card)', display: 'grid', placeItems: 'center', fontSize: 70 }}>
        🎨
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', perspective: 1200, height: 500 }}>
      <div className="image-slider-3d-stage" style={{
        position: 'absolute', inset: 0,
        transformStyle: 'preserve-3d',
      }}>
        {safeImages.map((img, i) => {
          const offset = i - index;
          const isActive = offset === 0;
          const clamped = Math.max(-2, Math.min(2, offset));
          return (
            <div
              key={img.id || i}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: '74%',
                height: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                transform: `translateX(-50%) translateX(${clamped * 120}px) rotateY(${clamped * -22}deg) translateZ(${isActive ? 40 : -120}px)`,
                opacity: Math.abs(clamped) > 2 ? 0 : isActive ? 1 : 0.55,
                transition: 'all 0.45s ease',
                border: `1px solid ${isActive ? 'rgba(200,150,42,0.5)' : 'var(--border)'}`,
                boxShadow: isActive ? '0 24px 60px rgba(0,0,0,0.55)' : '0 10px 25px rgba(0,0,0,0.35)',
              }}
            >
              <img src={img.image_path} alt="Artwork" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          );
        })}
      </div>

      {safeImages.length > 1 && (
        <>
          <button className="btn btn-outline" onClick={() => go(index - 1)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}>Prev</button>
          <button className="btn btn-outline" onClick={() => go(index + 1)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}>Next</button>
        </>
      )}
    </div>
  );
}
