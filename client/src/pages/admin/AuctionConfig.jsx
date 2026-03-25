import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

function toDatetimeLocal(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AuctionConfig() {
  const [config, setConfig] = useState({
    auction_start: '', auction_end: '', min_bid_increment: 50, is_paused: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/config').then(res => {
      if (res.data) {
        setConfig({
          ...res.data,
          auction_start: toDatetimeLocal(res.data.auction_start),
          auction_end: toDatetimeLocal(res.data.auction_end),
        });
      }
    }).catch(console.error);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/config', {
        auction_start: config.auction_start ? new Date(config.auction_start).toISOString() : null,
        auction_end: config.auction_end ? new Date(config.auction_end).toISOString() : null,
        min_bid_increment: parseFloat(config.min_bid_increment),
        is_paused: config.is_paused,
      });
      toast.success('Auction config saved');
    } catch { toast.error('Failed to save config'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 34, marginBottom: 28 }}>Auction Configuration</h1>
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Auction Start</label>
          <input type="datetime-local" value={config.auction_start} onChange={e => setConfig(c => ({ ...c, auction_start: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Auction End (Day 4, 6:00 PM)</label>
          <input type="datetime-local" value={config.auction_end} onChange={e => setConfig(c => ({ ...c, auction_end: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Minimum Bid Increment (₹)</label>
          <input type="number" value={config.min_bid_increment} onChange={e => setConfig(c => ({ ...c, min_bid_increment: e.target.value }))} min={1} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="checkbox" id="paused" checked={config.is_paused} onChange={e => setConfig(c => ({ ...c, is_paused: e.target.checked }))} style={{ width: 'auto' }} />
          <label htmlFor="paused" style={{ cursor: 'pointer', fontSize: 14 }}>Emergency Pause Auction</label>
        </div>
        <div style={{
          padding: '12px 16px',
          background: config.is_paused ? 'rgba(224,90,78,0.1)' : 'rgba(76,175,130,0.1)',
          border: `1px solid ${config.is_paused ? 'rgba(224,90,78,0.3)' : 'rgba(76,175,130,0.3)'}`,
          borderRadius: 8, fontSize: 14,
          color: config.is_paused ? 'var(--error)' : 'var(--bid-green)',
        }}>
          {config.is_paused
            ? '⏸ Auction is PAUSED — no bids can be placed'
            : '✓ Auction configuration is active'}
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '12px', fontSize: 15 }}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
