import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../hooks/useAuction';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { status } = useAuction();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const isMobile = window.innerWidth < 860;
      if (!isMobile) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      borderBottom: '1px solid var(--border)', padding: '0 16px',
      minHeight: 64,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, gap: 10 }}>
        <Link to="/gallery" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src="/arts-club-logo.png" alt="Arts Club" style={{ height: 28, width: 'auto' }} />
          <img src="https://www.iiserkol.ac.in/web/assets/images/logo/logo.png" alt="IISER Kolkata" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Cormorant Garamond', fontSize: 22, color: 'var(--accent-gold)', fontWeight: 600, whiteSpace: 'nowrap' }}>Chitrakavyam</span>
          <span
            style={{ fontSize: 10, background: statusColor[status], width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
            title={`Auction ${status}`}
          />
        </Link>

        <button
          className="btn btn-outline nav-mobile-toggle"
          style={{ padding: '6px 10px', fontSize: 18, lineHeight: 1, display: 'none' }}
          onClick={() => setMenuOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '×' : '☰'}
        </button>

        <div className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/gallery" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>Gallery</Link>
          {user && <Link to="/profile" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>My Bids</Link>}
          {user?.is_admin && <Link to="/masteradmin" style={{ color: 'var(--accent-warm)', textDecoration: 'none', fontSize: 14 }}>MasterAdmin</Link>}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.username}</span>
              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <Link to="/"><button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13 }}>Login</button></Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="nav-mobile-panel" style={{ display: 'none', paddingBottom: 14 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Link to="/gallery" onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 15 }}>Gallery</Link>
            {user && <Link to="/profile" onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 15 }}>My Bids</Link>}
            {user?.is_admin && <Link to="/masteradmin" onClick={() => setMenuOpen(false)} style={{ color: 'var(--accent-warm)', textDecoration: 'none', fontSize: 15 }}>MasterAdmin</Link>}
            {user ? (
              <button className="btn btn-outline" style={{ width: '100%', marginTop: 4 }} onClick={async () => { setMenuOpen(false); await handleLogout(); }}>
                Logout ({user.username})
              </button>
            ) : (
              <Link to="/" onClick={() => setMenuOpen(false)}><button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}>Login</button></Link>
            )}
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 900px) {
          .nav-desktop-links { display: none !important; }
          .nav-mobile-toggle { display: inline-flex !important; }
          .nav-mobile-panel { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
