import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function ArtworkCard({ artwork, onBidUpdate }) {
  const [pulsing, setPulsing] = useState(false);
  const imageUrl = artwork.primary_image || artwork.fallback_image;

  useEffect(() => {
    if (onBidUpdate) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 2000);
      return () => clearTimeout(t);
    }
  }, [artwork.current_highest_bid]);

  const isAuction = artwork.status === 'approved_auction';
  const isExhibit = artwork.status === 'approved_exhibit';

  return (
    <Link to={`/artwork/${artwork.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
          overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Image */}
        <div style={{ height: 220, background: '#111', overflow: 'hidden', position: 'relative' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={artwork.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 40 }}>🎨</div>
          )}

          {/* Bid badge */}
          {isAuction && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(15,14,13,0.85)', backdropFilter: 'blur(8px)',
              border: `1px solid ${pulsing ? 'var(--accent-gold)' : 'rgba(200,150,42,0.3)'}`,
              borderRadius: 20, padding: '4px 10px',
              color: 'var(--accent-warm)', fontSize: 14, fontWeight: 600,
              transition: 'border-color 0.3s',
              boxShadow: pulsing ? '0 0 12px rgba(200,150,42,0.4)' : 'none',
            }}>
              {artwork.current_highest_bid
                ? `₹${Number(artwork.current_highest_bid).toLocaleString('en-IN')}`
                : `₹${Number(artwork.base_price || 0).toLocaleString('en-IN')}`}
            </div>
          )}

          {isExhibit && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(138,127,116,0.3)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(138,127,116,0.3)', borderRadius: 20,
              padding: '4px 10px', color: 'var(--text-muted)', fontSize: 12,
            }}>
              Exhibit Only
            </div>
          )}

          {/* Bid count */}
          {isAuction && artwork.total_bids > 0 && (
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              background: 'rgba(15,14,13,0.7)', borderRadius: 12,
              padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)',
            }}>
              {artwork.total_bids} bid{artwork.total_bids !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 18, marginBottom: 4, color: 'var(--text-primary)' }}>
            {artwork.title || 'Untitled'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{artwork.artist_name}</div>
          {artwork.medium && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{artwork.medium}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
