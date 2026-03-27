export default function AppFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        background: 'rgba(15,14,13,0.95)',
        marginTop: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/arts-club-logo.png" alt="Arts Club" style={{ height: 24, width: 'auto' }} />
          <img src="https://www.iiserkol.ac.in/web/assets/images/logo/logo.png" alt="IISER Kolkata" style={{ height: 24, width: 'auto' }} />
          <img src="https://raw.githubusercontent.com/Shuvam-Banerji-Seal/Email-HTML/refs/heads/main/assets/SlashDot%20Main%20logo%20noBG%20W-01-02.png" alt="Slashdot" style={{ height: 18, width: 'auto' }} />
        </div>

        <a
          href="https://shuvam-banerji-seal.github.io/"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}
        >
          Developed by Shuvam Banerji Seal
        </a>
      </div>
    </footer>
  );
}
