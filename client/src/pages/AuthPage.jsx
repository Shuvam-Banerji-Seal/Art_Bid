import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../hooks/useAuction';
import CountdownTimer from '../components/CountdownTimer';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({
    email: '', password: '', username: '', confirm_password: '',
    roll_number: '', contact_number: '',
  });
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const { config, status } = useAuction();
  const navigate = useNavigate();

  const emailValid = form.email.endsWith('@iiserkol.ac.in');
  const emailTouched = form.email.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailValid) { toast.error('Only @iiserkol.ac.in emails are permitted'); return; }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        if (form.password !== form.confirm_password) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        if (form.password.length < 8) {
          toast.error('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        await signup({
          email: form.email, username: form.username,
          password: form.password, roll_number: form.roll_number,
          contact_number: form.contact_number,
        });
        toast.success('Account created!');
      }
      navigate('/gallery');
    } catch (err) {
      toast.error(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <div style={{
        flex: 1, background: 'linear-gradient(135deg, #1a1714 0%, #0f0e0d 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, borderRight: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>🎨</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 42, color: 'var(--accent-gold)', marginBottom: 16 }}>Chitrakavyam</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            IISER Kolkata Arts Club&apos;s annual art festival — live auction bidding on exceptional works.
          </p>
          {config && status === 'live' && (
            <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 8, padding: '12px 20px' }}>
              <div style={{ color: 'var(--bid-green)', fontSize: 12, marginBottom: 4 }}>🔴 AUCTION LIVE</div>
              <CountdownTimer targetDate={config.auction_end} label="Closes in" />
            </div>
          )}
          {config && status === 'upcoming' && (
            <div style={{ background: 'rgba(200,150,42,0.1)', border: '1px solid rgba(200,150,42,0.3)', borderRadius: 8, padding: '12px 20px' }}>
              <CountdownTimer targetDate={config.auction_start} label="Opens in" />
            </div>
          )}
          {status === 'ended' && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Auction has ended. Thank you for participating!</div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 32, marginBottom: 8, color: 'var(--text-primary)' }}>
            {tab === 'login' ? 'Welcome back' : 'Join the auction'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
            IISER Kolkata community members only.
          </p>

          {/* Tab toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 8, padding: 4, marginBottom: 28, border: '1px solid var(--border)' }}>
            {['login', 'signup'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 6, cursor: 'pointer',
                background: tab === t ? 'var(--accent-gold)' : 'transparent',
                color: tab === t ? '#000' : 'var(--text-muted)',
                fontFamily: 'DM Sans', fontSize: 14, fontWeight: tab === t ? 500 : 400,
                transition: 'all 0.2s',
              }}>{t === 'login' ? 'Login' : 'Sign Up'}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tab === 'signup' && (
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Your name" required />
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>IISER Email *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="yourname@iiserkol.ac.in" required
                  style={{ borderColor: emailTouched ? (emailValid ? 'var(--bid-green)' : 'var(--error)') : 'var(--border)' }}
                />
                {emailTouched && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                    {emailValid ? '✓' : '✗'}
                  </span>
                )}
              </div>
              {emailTouched && !emailValid && (
                <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>Only @iiserkol.ac.in emails are permitted</p>
              )}
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password *</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" required />
            </div>

            {tab === 'signup' && (
              <>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Confirm Password *</label>
                  <input type="password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} placeholder="Repeat password" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Roll Number</label>
                    <input value={form.roll_number} onChange={e => setForm({ ...form, roll_number: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>WhatsApp</label>
                    <input value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
              </>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', fontSize: 15, fontWeight: 500 }}>
              {loading ? 'Please wait...' : (tab === 'login' ? 'Login' : 'Create Account')}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 24 }}>
            Only @iiserkol.ac.in emails are permitted.
          </p>
        </div>
      </div>
    </div>
  );
}
