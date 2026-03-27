import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentBids, setRecentBids] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, bidsRes] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/bids?limit=20'),
        ]);
        setStats(statsRes.data);
        setRecentBids(bidsRes.data.bids || []);
      } catch (err) {
        console.error(err);
      }
    };
    load();

    const socket = io(import.meta.env.VITE_WS_URL || '', { withCredentials: true });
    socket.on('bid:new', () => {
      api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
      api.get('/admin/bids?limit=20').then(r => setRecentBids(r.data.bids || [])).catch(() => {});
    });
    return () => socket.disconnect();
  }, []);

  const togglePause = async () => {
    try {
      await api.post('/admin/config', { is_paused: !stats?.config?.is_paused });
      toast.success(stats?.config?.is_paused ? 'Auction resumed' : 'Auction paused');
      const r = await api.get('/admin/stats');
      setStats(r.data);
    } catch { toast.error('Failed to update auction'); }
  };

  const exportWinners = async () => {
    try {
      const res = await api.get('/admin/winners');
      const csv = [
        'Artwork ID,Title,Artist,Winner Name,Winner Email,Roll,Contact,Final Price',
        ...res.data.map(w => `${w.artwork_id},"${w.title}","${w.artist_name}","${w.winner_name}",${w.winner_email},${w.winner_roll || ''},${w.winner_contact || ''},${w.final_price}`),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'chitrakavyam_winners.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Winners exported!');
    } catch { toast.error('Failed to export'); }
  };

  const statCards = stats ? [
    { label: 'Total Artworks', value: stats.totalArtworks, color: 'var(--accent-warm)' },
    { label: 'Bids Today', value: stats.bidsToday, color: 'var(--bid-green)' },
    { label: 'Registered Users', value: stats.totalUsers, color: 'var(--accent-gold)' },
    { label: 'Highest Bid', value: `₹${Number(stats.highestBid || 0).toLocaleString('en-IN')}`, color: 'var(--accent-warm)' },
  ] : [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 36 }}>MasterAdmin Dashboard</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={togglePause}>
            {stats?.config?.is_paused ? '▶ Resume Auction' : '⏸ Pause Auction'}
          </button>
          <button className="btn btn-primary" onClick={exportWinners}>Export Winners CSV</button>
        </div>
      </div>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: stats?.auctionStatus === 'live' ? 'var(--bid-green)' : 'var(--text-muted)', display: 'inline-block' }} />
        <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>
          Auction Status: <strong style={{ color: 'var(--text-primary)' }}>{stats?.auctionStatus || 'loading...'}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, color }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 22, marginBottom: 16 }}>Live Bid Activity</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Artwork', 'Bidder', 'Amount', 'Time', 'IP'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBids.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px' }}>{b.artwork_title}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{b.username}</td>
                  <td style={{ padding: '10px', color: 'var(--accent-warm)' }}>₹{Number(b.bid_amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{new Date(b.bid_time).toLocaleString()}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: 11 }}>{b.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentBids.length === 0 && <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No bids yet.</p>}
        </div>
      </div>
    </div>
  );
}
