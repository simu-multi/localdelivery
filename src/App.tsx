import { useAuth } from './lib/auth';
import { PSpinner } from '@porsche-design-system/components-react';
import AuthPage from './pages/AuthPage';
import ProfileSetup from './pages/ProfileSetup';
import ShopDashboard from './pages/ShopDashboard';
import RiderDashboard from './pages/RiderDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { user, profile, loading, resetFlow } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#006FFF' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <PSpinner size="small" aria={{ 'aria-label': 'Loading QuickDrop' }} />
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  // Stay on AuthPage during the forgot-password reset flow even though the user
  // is technically signed in (verifyOtp signs them in). AuthPage renders the
  // new-password form in this case.
  if (resetFlow) return <AuthPage />;
  if (!profile) return <ProfileSetup />;

  if (profile.role === 'admin') return <AdminDashboard />;
  if (profile.role === 'rider') return <RiderDashboard />;
  return <ShopDashboard />;
}
