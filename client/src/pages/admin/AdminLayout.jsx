import { Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Loading...
    </div>
  );
  if (!user?.is_admin) return <Navigate to="/" />;

  const links = [
    { to: '/admin', label: '📊 Dashboard' },
    { to: '/admin/artworks', label: '🎨 Artworks' },
    { to: '/admin/bids', label: '💰 Bid Log' },
    { to: '/admin/users', label: '👥 Users' },
    { to: '/admin/config', label: '⚙️ Config' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '24px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <Link to="/gallery" style={{ textDecoration: 'none', fontFamily: 'Cormorant Garamond', fontSize: 20, color: 'var(--accent-gold)' }}>Chitrakavyam</Link>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Admin Panel</div>
        </div>
        {links.map(({ to, label }) => {
          const isActive = to === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(to);
          return (
            <Link key={to} to={to} style={{
              display: 'block', padding: '10px 20px', textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 14, transition: 'color 0.15s',
              background: isActive ? 'rgba(200,150,42,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
            }}>
              {label}
            </Link>
          );
        })}
        <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0 0', padding: '16px 20px 0' }}>
          <Link to="/gallery" style={{ display: 'block', padding: '8px 0', textDecoration: 'none', color: 'var(--text-muted)', fontSize: 13 }}>← Back to Gallery</Link>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, background: 'var(--bg-primary)', overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
