import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Generation from './pages/Generation';
import Pods from './pages/Pods';
import StyleProfile from './pages/StyleProfile';
import Settings from './pages/Settings';
import authAPI from './services/authAPI';
import { Toaster } from './components/ui/sonner';

const hasCompletedOnboarding = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem('userProfile');
  if (stored) {
    try {
      const profile = JSON.parse(stored);
      if (profile?.onboardingComplete) return true;
    } catch {
      // ignore parse issues and fall back to other sources
    }
  }

  const currentUserRaw = window.localStorage.getItem('currentUser');
  if (!currentUserRaw) return false;

  try {
    const currentUser = JSON.parse(currentUserRaw);
    return Boolean(currentUser?.onboardingComplete);
  } catch {
    return false;
  }
};

const RootRedirect = () => {
  const destination = authAPI.isAuthenticated()
    ? hasCompletedOnboarding()
      ? '/home'
      : '/onboarding'
    : '/login';

  return <Navigate to={destination} replace />;
};

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  if (authAPI.isAuthenticated()) {
    const destination = hasCompletedOnboarding() ? '/home' : '/onboarding';
    return <Navigate to={destination} replace />;
  }
  return children;
};

const RequireAuth = () => {
  const location = useLocation();
  if (!authAPI.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
};

const OnboardingRoute = () => {
  const alreadyCompleted = useMemo(() => hasCompletedOnboarding(), []);
  if (alreadyCompleted) {
    return <Navigate to="/home" replace />;
  }
  return <Onboarding />;
};

const App = () => {
  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingRoute />} />

          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/generate" element={<Generation />} />
            <Route path="/pods" element={<Pods />} />
            <Route path="/style-profile" element={<StyleProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
