import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }) {
  const { user, loading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(!user);

  useEffect(() => {
    // If user passed from AuthCallback, skip check
    if (location.state?.user) {
      setIsChecking(false);
      return;
    }

    // If we already have user, no need to check
    if (user) {
      setIsChecking(false);
      return;
    }

    // If still loading initial auth, wait
    if (loading) return;

    // Check authentication
    const verify = async () => {
      const authUser = await checkAuth();
      if (!authUser) {
        navigate('/', { replace: true });
      }
      setIsChecking(false);
    };

    verify();
  }, [user, loading, checkAuth, navigate, location.state]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}
