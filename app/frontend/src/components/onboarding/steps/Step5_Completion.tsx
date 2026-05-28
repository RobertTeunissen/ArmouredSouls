/**
 * Step 9: Completion
 * Phase 1: Subscription picker — choose event subscriptions for the first robot.
 * Phase 2: Congratulations screen. "Complete Tutorial & Start Playing" → navigates to in-game guide.
 *
 * Requirements: R8.1, R8.5
 */
import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';
import SubscriptionPicker from '../../subscriptions/SubscriptionPicker';

interface UserProfile {
  currency: number;
  prestige?: number;
}

interface RobotSummary {
  id: number;
  name: string;
}

const Step9_Completion = ({ onNext: _onNext }: { onNext: () => void; onPrevious: () => void }) => {
  const { tutorialState, completeTutorial, error: ctxErr } = useOnboarding();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const attempted = useRef(false);

  // Subscription picker phase
  const [phase, setPhase] = useState<'subscriptions' | 'done'>('subscriptions');
  const [firstRobotId, setFirstRobotId] = useState<number | null>(null);
  const [allRobotIds, setAllRobotIds] = useState<number[]>([]);
  const [robotCount, setRobotCount] = useState(1);
  const [credits, setCredits] = useState(0);
  const [prestige, setPrestige] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch the first robot ID and user profile for the subscription picker
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [robots, profile] = await Promise.all([
          api.get<RobotSummary[]>('/api/robots'),
          api.get<UserProfile>('/api/user/profile'),
        ]);
        if (robots.length > 0) {
          // Use the first robot created during onboarding
          const onboardingRobots = tutorialState?.choices?.robotsCreated;
          const targetId = onboardingRobots && onboardingRobots.length > 0
            ? onboardingRobots[0]
            : robots[0].id;
          setFirstRobotId(targetId);
          setAllRobotIds(robots.map(r => r.id));
          setRobotCount(robots.length);
        }
        setCredits(profile.currency);
        setPrestige(profile.prestige ?? 0);
      } catch {
        // If we can't load data, skip the picker and go straight to completion
        setPhase('done');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchData();
  }, [tutorialState?.choices?.robotsCreated]);

  const handlePickerComplete = () => {
    setPhase('done');
  };

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

  // Phase 1: Subscription picker
  if (phase === 'subscriptions') {
    if (profileLoading) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-secondary">Loading subscription options...</div>
        </div>
      );
    }

    if (firstRobotId === null) {
      // No robot found — skip to completion
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-secondary">Setting up your account...</div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <span className="text-4xl block mb-3">📋</span>
          <h2 className="text-2xl font-bold mb-2">Choose Your Battle Events</h2>
          <p className="text-secondary text-sm">
            Select which events your {robotCount > 1 ? 'robots' : 'robot'} will compete in. You can change these later from the Robot Detail page.
          </p>
        </div>
        <SubscriptionPicker
          robotId={firstRobotId}
          allRobotIds={allRobotIds}
          robotCount={robotCount}
          credits={credits}
          prestige={prestige}
          onComplete={handlePickerComplete}
        />
      </div>
    );
  }

  // Phase 2: Congratulations
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
