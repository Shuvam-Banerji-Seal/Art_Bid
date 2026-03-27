import { Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Loading...
    </div>
  );
  if (!user?.is_admin) return <Navigate to="/" />;

  const links = [
    { to: '/masteradmin', label: '📊 Dashboard' },
    { to: '/masteradmin/artworks', label: '🎨 Artworks' },
    { to: '/masteradmin/bids', label: '💰 Bid Log' },
    { to: '/masteradmin/users', label: '👥 Users' },
    { to: '/masteradmin/config', label: '⚙️ Config' },
  ];

  return (
    <div style={{ display: mobile ? 'block' : 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: mobile ? '100%' : 220, background: 'var(--bg-card)', borderRight: mobile ? 'none' : '1px solid var(--border)', borderBottom: mobile ? '1px solid var(--border)' : 'none', padding: mobile ? '10px 0' : '24px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <Link to="/gallery" style={{ textDecoration: 'none', fontFamily: 'Cormorant Garamond', fontSize: 20, color: 'var(--accent-gold)' }}>Chitrakavyam</Link>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>MasterAdmin Panel</div>
        </div>
        <div style={{ display: mobile ? 'flex' : 'block', overflowX: mobile ? 'auto' : 'visible', whiteSpace: mobile ? 'nowrap' : 'normal' }}>
        {links.map(({ to, label }) => {
          const isActive = to === '/masteradmin'
            ? location.pathname === '/masteradmin' || location.pathname === '/masteradmin/'
            : location.pathname.startsWith(to);
          return (
            <Link key={to} to={to} style={{
              display: 'block', padding: '10px 20px', textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 14, transition: 'color 0.15s',
              background: isActive ? 'rgba(200,150,42,0.08)' : 'transparent',
              borderLeft: !mobile && isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
              borderBottom: mobile && isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
            }}>
              {label}
            </Link>
          );
        })}
        </div>
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
