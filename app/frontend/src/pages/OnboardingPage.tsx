import { OnboardingProvider } from '../contexts/OnboardingContext';
import OnboardingContainer from '../components/onboarding/OnboardingContainer';

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingContainer />
    </OnboardingProvider>
  );
}
