import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../hooks/useAuction';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { status } = useAuction();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  const statusColor = {
    live: '#4caf82',
    upcoming: '#e8b86d',
    ended: '#e05a4e',
    paused: '#e8b86d',
    loading: '#8a7f74',
    error: '#8a7f74',
    not_configured: '#8a7f74',
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(15,14,13,0.95)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)', padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
    }}>
      <Link to="/gallery" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'Cormorant Garamond', fontSize: 24, color: 'var(--accent-gold)', fontWeight: 600 }}>Chitrakavyam</span>
        <span
          style={{ fontSize: 10, background: statusColor[status], width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}
          title={`Auction ${status}`}
        />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link to="/gallery" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>Gallery</Link>
        {user && <Link to="/profile" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>My Bids</Link>}
        {user?.is_admin && <Link to="/admin" style={{ color: 'var(--accent-warm)', textDecoration: 'none', fontSize: 14 }}>Admin</Link>}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.username}</span>
            <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <Link to="/"><button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }}>Login</button></Link>
        )}
      </div>
    </nav>
  );
}
