import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user } = useAuth();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ username: '', roll_number: '', contact_number: '' });

  useEffect(() => {
    if (user) {
      setForm({ username: user.username || '', roll_number: user.roll_number || '', contact_number: user.contact_number || '' });
      api.get('/bids/my').then(res => setBids(res.data)).catch(console.error).finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const socket = io(import.meta.env.VITE_WS_URL || '', { withCredentials: true });
    socket.on('bid:youOutbid', ({ artworkTitle }) => {
      toast.error(`You've been outbid on "${artworkTitle}"!`, { duration: 6000, icon: '⚡' });
      api.get('/bids/my').then(res => setBids(res.data)).catch(() => {});
    });
    socket.on('bid:new', () => {
      api.get('/bids/my').then(res => setBids(res.data)).catch(() => {});
    });
    return () => socket.disconnect();
  }, [user]);

  if (!user) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Please login to view your profile</p>
        <Link to="/"><button className="btn btn-primary">Login</button></Link>
      </div>
    </div>
  );

  const winningBids = bids.filter(b => b.is_winning);
  const outbidBids = bids.filter(b => !b.is_winning);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 38, marginBottom: 8 }}>My Profile</h1>

        {/* Account Info */}
        <div className="card" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 22 }}>Account Details</h2>
            <button className="btn btn-outline" onClick={() => setEditMode(p => !p)} style={{ padding: '6px 14px', fontSize: 13 }}>
              {editMode ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {!editMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                ['Email', user.email],
                ['Name', user.username || '—'],
                ['Roll Number', user.roll_number || '—'],
                ['WhatsApp', user.contact_number || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15 }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 15 }}>{user.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Name</div>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Roll Number</div>
                <input value={form.roll_number} onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>WhatsApp</div>
                <input value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          )}
          {editMode && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={async () => {
              try {
                await api.patch('/auth/profile', form);
                toast.success('Profile updated');
                setEditMode(false);
              } catch { toast.error('Failed to update profile'); }
            }}>Save Changes</button>
          )}
        </div>

        {/* Bid Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            ['Total Bids', bids.length, 'var(--text-primary)'],
            ['Currently Winning', winningBids.length, 'var(--bid-green)'],
            ['Outbid', outbidBids.length, 'var(--error)'],
          ].map(([label, count, color]) => (
            <div key={label} className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, color }}>{count}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* My Bids Table */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 22, marginBottom: 20 }}>My Bids</h2>
          {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading bids...</p> : bids.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              You haven&apos;t placed any bids yet.{' '}
              <Link to="/gallery" style={{ color: 'var(--accent-warm)' }}>Browse the gallery</Link>.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Artwork', 'Your Bid', 'Current Bid', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bids.map(b => (
                    <tr key={b.artwork_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <Link to={`/artwork/${b.artwork_id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                          <div style={{ fontWeight: 500 }}>{b.title || 'Untitled'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.artist_name}</div>
                        </Link>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--accent-warm)' }}>₹{Number(b.bid_amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px' }}>₹{Number(b.current_highest_bid || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge ${b.is_winning ? 'badge-green' : 'badge-red'}`}>
                          {b.is_winning ? '🏆 Winning' : '⬆ Outbid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
