import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import ArtworkCard from '../components/ArtworkCard';
import CountdownTimer from '../components/CountdownTimer';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { useAuction } from '../hooks/useAuction';

export default function GalleryPage() {
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', item_type: '', sort: '', search: '' });
  const { config, status } = useAuction();

  const fetchArtworks = useCallback(async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.item_type) params.item_type = filter.item_type;
      if (filter.sort) params.sort = filter.sort;
      if (filter.search) params.search = filter.search;
      const res = await api.get('/artworks', { params });
      setArtworks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchArtworks(); }, [fetchArtworks]);

  // WebSocket live updates
  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL || '', { withCredentials: true });
    socket.on('bid:new', ({ artworkId, newAmount, totalBids }) => {
      setArtworks(prev => prev.map(a =>
        a.id === artworkId
          ? { ...a, current_highest_bid: newAmount, total_bids: totalBids }
          : a
      ));
    });
    return () => socket.disconnect();
  }, []);

  const statusBannerColor = {
    live: 'rgba(76,175,130,0.1)',
    upcoming: 'rgba(200,150,42,0.1)',
    ended: 'rgba(224,90,78,0.1)',
    paused: 'rgba(232,184,109,0.1)',
  };
  const statusBorderColor = {
    live: 'rgba(76,175,130,0.3)',
    upcoming: 'rgba(200,150,42,0.3)',
    ended: 'rgba(224,90,78,0.3)',
    paused: 'rgba(232,184,109,0.3)',
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Auction status banner */}
        {config && (
          <div style={{
            background: statusBannerColor[status] || 'rgba(138,127,116,0.1)',
            border: `1px solid ${statusBorderColor[status] || 'rgba(138,127,116,0.3)'}`,
            borderRadius: 10, padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 32, flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>
                {status === 'live' ? '🔴' : status === 'upcoming' ? '🟡' : '⚫'}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                {status === 'live' && 'AUCTION LIVE'}
                {status === 'upcoming' && 'Auction Upcoming'}
                {status === 'ended' && 'Auction Ended'}
                {status === 'paused' && 'Auction Paused'}
              </span>
            </div>
            {status === 'live' && <CountdownTimer targetDate={config.auction_end} label="Closes in" />}
            {status === 'upcoming' && <CountdownTimer targetDate={config.auction_start} label="Opens in" />}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 42, color: 'var(--text-primary)' }}>Gallery</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 4 }}>{artworks.length} artworks</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search artworks or artists..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            style={{ maxWidth: 260 }}
          />
          <select value={filter.item_type} onChange={e => setFilter(f => ({ ...f, item_type: e.target.value }))} style={{ width: 'auto' }}>
            <option value="">All Types</option>
            <option value="Artwork">Paintings</option>
            <option value="Sculpture">Sculptures</option>
            <option value="Stall">Stall Items</option>
          </select>
          <select value={filter.sort} onChange={e => setFilter(f => ({ ...f, sort: e.target.value }))} style={{ width: 'auto' }}>
            <option value="">Newest First</option>
            <option value="highest_bid">Highest Bid</option>
            <option value="most_bids">Most Bids</option>
            <option value="base_price">Base Price</option>
          </select>
          {['approved_auction', 'approved_exhibit'].map(s => (
            <button key={s}
              className={`btn ${filter.status === s ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter(f => ({ ...f, status: f.status === s ? '' : s }))}
              style={{ padding: '8px 16px', fontSize: 13 }}>
              {s === 'approved_auction' ? 'Auction' : 'Exhibit'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading artworks...</div>
        ) : artworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>��</div>
            <p>No artworks found matching your filters.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {artworks.map(a => <ArtworkCard key={a.id} artwork={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}
