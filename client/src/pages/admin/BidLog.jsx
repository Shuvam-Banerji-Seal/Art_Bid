import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function BidLog() {
  const [bids, setBids] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      const res = await api.get('/admin/bids', { params: { page, limit: 50 } });
      setBids(res.data.bids || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [page]);

  const voidBid = async (id) => {
    if (!confirm('Void this bid? This will recalculate the current winner.')) return;
    try {
      await api.delete(`/admin/bids/${id}`);
      toast.success('Bid voided and winner recalculated');
      load();
    } catch { toast.error('Failed to void bid'); }
  };

  const exportCSV = async () => {
    try {
      const res = await api.get('/admin/bids?limit=10000');
      const csv = [
        'ID,Artwork,Bidder,Email,Amount,Time,IP,Voided',
        ...(res.data.bids || []).map(b =>
          `${b.id},"${b.artwork_title}","${b.username}",${b.email},${b.bid_amount},${new Date(b.bid_time).toISOString()},${b.ip_address || ''},${b.is_voided}`
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'all_bids.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to export'); }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 34 }}>Bid Log</h1>
        <button className="btn btn-outline" onClick={exportCSV}>Export All CSV</button>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Artwork', 'Bidder', 'Amount', 'Time', 'IP', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border)', opacity: b.is_voided ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{b.id}</td>
                  <td style={{ padding: '10px 12px' }}>{b.artwork_title}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div>{b.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent-warm)' }}>₹{Number(b.bid_amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{new Date(b.bid_time).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{b.ip_address || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${b.is_voided ? 'badge-red' : 'badge-green'}`}>
                      {b.is_voided ? 'Voided' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {!b.is_voided && (
                      <button className="btn btn-danger" onClick={() => voidBid(b.id)} style={{ padding: '4px 8px', fontSize: 11 }}>Void</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total: {total}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px' }}>Prev</button>
          <button className="btn btn-outline" disabled={bids.length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px' }}>Next</button>
        </div>
      </div>
    </div>
  );
}
