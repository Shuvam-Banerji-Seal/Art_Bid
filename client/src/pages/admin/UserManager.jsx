import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      const res = await api.get('/admin/users', { params: { page, limit: 30 } });
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [page]);

  const toggleBan = async (id, banned) => {
    try {
      await api.patch(`/admin/users/${id}`, { is_banned: !banned });
      toast.success(banned ? 'User unbanned' : 'User banned');
      load();
    } catch { toast.error('Failed to update user'); }
  };

  const toggleAdmin = async (id, isAdmin) => {
    try {
      await api.patch(`/admin/users/${id}`, { is_admin: !isAdmin });
      toast.success(isAdmin ? 'Admin role removed' : 'User promoted to admin');
      load();
    } catch { toast.error('Failed to update user'); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 34, marginBottom: 24 }}>User Management</h1>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Name', 'Email', 'Roll', 'Registered', 'Total Bids', 'Winning', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.id}</td>
                  <td style={{ padding: '10px 12px' }}>{u.username}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>{u.roll_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px' }}>{u.total_bids}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--bid-green)' }}>{u.winning_bids}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${u.is_admin ? 'badge-gold' : 'badge-muted'}`}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${u.is_banned ? 'badge-red' : 'badge-green'}`}>
                      {u.is_banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" onClick={() => toggleBan(u.id, u.is_banned)} style={{ padding: '4px 8px', fontSize: 11 }}>
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                      <button className="btn btn-outline" onClick={() => toggleAdmin(u.id, u.is_admin)} style={{ padding: '4px 8px', fontSize: 11 }}>
                        {u.is_admin ? '−Admin' : '+Admin'}
                      </button>
                    </div>
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
          <button className="btn btn-outline" disabled={users.length < 30} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px' }}>Next</button>
        </div>
      </div>
    </div>
  );
}
