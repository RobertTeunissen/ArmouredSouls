/**
 * Step 9: Completion
 * Congratulations screen. "Complete Tutorial & Start Playing" → navigates to in-game guide.
 */
import { useState, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useAuth } from '../../../contexts/AuthContext';

const Step9_Completion = ({ onNext: _onNext }: { onNext: () => void; onPrevious: () => void }) => {
  const { completeTutorial, error: ctxErr } = useOnboarding();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const attempted = useRef(false);

  const err = attempted.current && ctxErr ? ctxErr : null;

  const handleComplete = async () => {
    setCompleting(true);
    attempted.current = true;
    try {
      await completeTutorial();
      await refreshUser();
      navigate('/guide');
    } catch {
      setCompleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <span className="text-6xl block mb-6">🏆</span>
      <h1 className="text-3xl font-bold mb-4 text-gray-100">Congratulations, Commander!</h1>
      <p className="text-lg text-secondary mb-10">
        You've completed the Armoured Souls onboarding. Your robots are built, equipped, and ready for battle.
        Time to prove yourself in the arena.
      </p>

      <p className="text-sm text-tertiary mb-10">
        Not happy with your choices? Until your first battle is scheduled, you can reset your account
        and redo the tutorial from your profile page.
      </p>

      {err && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6" role="alert">
          <p className="text-error">{err}</p>
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={completing}
        className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {completing ? 'Completing…' : 'Complete Tutorial & Start Playing'}
      </button>
    </div>
  );
};

export default memo(Step9_Completion);
