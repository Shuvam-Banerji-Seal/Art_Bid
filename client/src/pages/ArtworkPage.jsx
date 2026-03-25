import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';
import CountdownTimer from '../components/CountdownTimer';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../hooks/useAuction';
import api from '../utils/api';
import toast from 'react-hot-toast';

function ImageCarousel({ images }) {
  const [current, setCurrent] = useState(0);
  if (!images || images.length === 0) return (
    <div style={{ height: 400, background: 'var(--bg-card)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🎨</div>
  );
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ height: 480, background: '#111' }}>
        <img src={images[current]?.image_path} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(p => (p - 1 + images.length) % images.length)}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,14,13,0.7)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: 18 }}>‹</button>
          <button
            onClick={() => setCurrent(p => (p + 1) % images.length)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,14,13,0.7)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: 18 }}>›</button>
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 20 : 8, height: 8, borderRadius: 4, background: i === current ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'width 0.2s' }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BidConfirmModal({ amount, artwork, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ padding: 32, maxWidth: 400, width: '90%' }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', fontSize: 24, marginBottom: 16 }}>Confirm Your Bid</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>You are placing a bid on:</p>
        <p style={{ fontWeight: 500, marginBottom: 16 }}>{artwork?.title}</p>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, textAlign: 'center' }}>
          <span style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, color: 'var(--accent-warm)' }}>₹{Number(amount).toLocaleString('en-IN')}</span>
        </div>
        <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 24 }}>⚠️ Bids cannot be undone once placed.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} style={{ flex: 1 }}>Confirm Bid</button>
        </div>
      </div>
    </div>
  );
}

export default function ArtworkPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { config, status } = useAuction();
  const [artwork, setArtwork] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [liveFeed, setLiveFeed] = useState([]);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [artworkRes, bidsRes] = await Promise.all([
        api.get(`/artworks/${id}`),
        api.get(`/artworks/${id}/bids`),
      ]);
      setArtwork(artworkRes.data);
      setBids(bidsRes.data);
      const minBid = artworkRes.data.current_highest_bid
        ? parseFloat(artworkRes.data.current_highest_bid) + 50
        : parseFloat(artworkRes.data.base_price || 0);
      setBidAmount(String(minBid));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || '', { withCredentials: true });
    socket.emit('subscribe:artwork', { artworkId: parseInt(id) });

    socket.on('bid:new', (data) => {
      if (data.artworkId === parseInt(id)) {
        setArtwork(prev => ({ ...prev, current_highest_bid: data.newAmount, total_bids: data.totalBids }));
        const newMinBid = parseFloat(data.newAmount) + 50;
        setBidAmount(prev => parseFloat(prev) <= parseFloat(data.newAmount) ? String(newMinBid) : prev);
        setLiveFeed(prev => [{ id: Date.now(), amount: data.newAmount, bidder: data.bidderMasked, time: data.timestamp }, ...prev.slice(0, 4)]);
        api.get(`/artworks/${id}/bids`).then(res => setBids(res.data)).catch(() => {});
      }
    });

    socket.on('bid:youOutbid', ({ artworkId, artworkTitle }) => {
      if (artworkId === parseInt(id)) {
        toast.error(`You've been outbid on "${artworkTitle}"!`, { duration: 5000, icon: '⚡' });
      }
    });

    return () => {
      socket.emit('unsubscribe:artwork', { artworkId: parseInt(id) });
      socket.disconnect();
    };
  }, [id]);

  const placeBid = async () => {
    if (!user) { toast.error('Please login to bid'); return; }
    setSubmitting(true);
    try {
      await api.post('/bids', { artwork_id: parseInt(id), bid_amount: parseFloat(bidAmount) });
      toast.success('Bid placed successfully!', { icon: '🎨' });
      setShowConfirm(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place bid');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading...</div>
    </div>
  );
  if (!artwork) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--error)' }}>Artwork not found</div>
    </div>
  );

  const isAuction = artwork.status === 'approved_auction';
  const isLive = status === 'live';
  const currentBid = parseFloat(artwork.current_highest_bid || 0);
  const basePrice = parseFloat(artwork.base_price || 0);
  const minNextBid = artwork.current_highest_bid ? currentBid + 50 : basePrice;
  const bidValid = parseFloat(bidAmount) >= minNextBid;

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      {showConfirm && (
        <BidConfirmModal
          amount={bidAmount}
          artwork={artwork}
          onConfirm={placeBid}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <Link to="/gallery" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          ← Back to Gallery
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 40, alignItems: 'start' }}>
          {/* Left: Images */}
          <div>
            <ImageCarousel images={artwork.images} />

            {liveFeed.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {liveFeed.map(f => (
                  <div key={f.id} className="fade-in" style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--bid-green)' }}>
                    🎨 {f.bidder || 'Someone'} just bid ₹{Number(f.amount).toLocaleString('en-IN')}!
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details + Bid Panel */}
          <div style={{ position: 'sticky', top: 80 }}>
            <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, marginBottom: 8, lineHeight: 1.2 }}>
              {artwork.title || 'Untitled'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 20 }}>by {artwork.artist_name}</p>

            {/* Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Medium', artwork.medium],
                ['Surface', artwork.surface_used],
                ['Dimensions', artwork.dimensions],
                ['Framed', artwork.is_framed ? 'Yes' : artwork.is_framed === false ? 'No' : 'N/A'],
              ].filter(([, v]) => v && v !== 'N/A').map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>

            {artwork.description && (
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{artwork.description}</p>
            )}

            {/* Bid Panel */}
            {isAuction ? (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {artwork.current_highest_bid ? 'Current Bid' : 'Starting Price'}
                  </div>
                  <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 44, color: 'var(--accent-warm)', lineHeight: 1 }}>
                    ₹{Number(artwork.current_highest_bid || artwork.base_price || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {artwork.total_bids || 0} bid{artwork.total_bids !== 1 ? 's' : ''} • Min. next: ₹{minNextBid.toLocaleString('en-IN')}
                  </div>
                </div>

                {isLive && user && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {[50, 100, 500].map(inc => (
                        <button key={inc} className="btn btn-outline"
                          onClick={() => setBidAmount(String(Math.max(minNextBid, parseFloat(bidAmount || 0) + inc)))}
                          style={{ padding: '6px 12px', fontSize: 13 }}>+{inc}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button
                        onClick={() => setBidAmount(String(Math.max(minNextBid, parseFloat(bidAmount) - 50)))}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 18 }}>−</button>
                      <input
                        type="number" value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        min={minNextBid}
                        style={{ flex: 1, textAlign: 'center', fontSize: 18 }}
                      />
                      <button
                        onClick={() => setBidAmount(String(parseFloat(bidAmount) + 50))}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 18 }}>+</button>
                    </div>
                    <button className="btn btn-primary"
                      disabled={!bidValid || submitting}
                      onClick={() => setShowConfirm(true)}
                      style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 500 }}>
                      {submitting ? 'Placing Bid...' : `Place Bid — ₹${Number(bidAmount).toLocaleString('en-IN')}`}
                    </button>
                    {!bidValid && bidAmount && (
                      <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>
                        Minimum bid is ₹{minNextBid.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                )}

                {isLive && !user && (
                  <Link to="/"><button className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>Login to Bid</button></Link>
                )}

                {!isLive && status !== 'loading' && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
                    {status === 'upcoming' && config && <CountdownTimer targetDate={config.auction_start} label="Auction opens in" />}
                    {status === 'ended' && 'Auction has ended'}
                    {status === 'paused' && 'Auction is currently paused'}
                  </div>
                )}

                {/* Bid history */}
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button
                    onClick={() => setBidHistoryOpen(p => !p)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {bidHistoryOpen ? '▾' : '▸'} Bid History ({bids.length} shown)
                  </button>
                  {bidHistoryOpen && bids.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {bids.map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', background: i === 0 ? 'rgba(200,150,42,0.1)' : 'transparent', borderRadius: 4 }}>
                          <span style={{ color: i === 0 ? 'var(--accent-warm)' : 'var(--text-muted)' }}>{b.bidder_masked}</span>
                          <span style={{ color: i === 0 ? 'var(--accent-warm)' : 'var(--text-primary)', fontWeight: i === 0 ? 500 : 400 }}>₹{Number(b.bid_amount).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {bidHistoryOpen && bids.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No bids yet. Be the first!</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                <span className="badge badge-muted">
                  {artwork.status === 'approved_exhibit' ? '🖼 Exhibit Only' : '⬜ Not for Sale'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
