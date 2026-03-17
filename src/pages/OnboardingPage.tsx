import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { OnboardingModal } from '@/components/OnboardingModal';
import { useState, useEffect } from 'react';

/**
 * Standalone onboarding page — optional manual route.
 * No auto-redirect. Users can access /onboarding directly if they want.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile?.onboarding_completed]);

  const handleClose = () => {
    setOpen(false);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <OnboardingModal open={open} onClose={handleClose} />
    </div>
  );
}
