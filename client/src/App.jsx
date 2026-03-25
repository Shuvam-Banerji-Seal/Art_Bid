import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import GalleryPage from './pages/GalleryPage';
import ArtworkPage from './pages/ArtworkPage';
import ProfilePage from './pages/ProfilePage';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ArtworkManager from './pages/admin/ArtworkManager';
import BidLog from './pages/admin/BidLog';
import UserManager from './pages/admin/UserManager';
import AuctionConfig from './pages/admin/AuctionConfig';
import './styles/globals.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            },
            success: { iconTheme: { primary: 'var(--bid-green)', secondary: '#000' } },
          }}
        />
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/artwork/:id" element={<ArtworkPage />} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="artworks" element={<ArtworkManager />} />
            <Route path="bids" element={<BidLog />} />
            <Route path="users" element={<UserManager />} />
            <Route path="config" element={<AuctionConfig />} />
          </Route>
          <Route path="*" element={<Navigate to="/gallery" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
