import React from 'react';

interface Step1_WelcomeProps {
  onNext: () => void;
}

/**
 * Step 1: Welcome and Strategic Overview
 * 
 * Introduces new players to the game and the fundamental strategic question:
 * "How many robots should I build?"
 * 
 * Requirements: 2.2
 */
const Step1_Welcome: React.FC<Step1_WelcomeProps> = ({ onNext }) => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-6">
          <img 
            src="/assets/onboarding/game-logo.png" 
            alt="Armoured Souls" 
            className="h-24 w-auto"
            onError={(e) => {
              // Fallback if image doesn't exist yet
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        <h1 className="text-4xl font-bold text-gray-100">
          Welcome to Armoured Souls
        </h1>
        
        <p className="text-xl text-gray-200">
          Build, battle, and dominate in the ultimate robot combat strategy game
        </p>
      </div>

      {/* Game Goal */}
      <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-lg p-8 border-2 border-purple-700">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              What's the Goal?
            </h2>
            <p className="text-gray-200 leading-relaxed mb-4">
              Your goal is to build and manage a stable of combat robots that compete in leagues and tournaments. 
              Success means climbing the league rankings, earning credits through battles, and building prestige 
              through victories. You'll need to balance robot power, battle frequency, facility investments, and 
              economic sustainability.
            </p>
            <p className="text-gray-200 leading-relaxed">
              There's no single "right" way to play—some managers focus on one powerful robot, others spread their 
              resources across multiple fighters. Your strategy determines your path to success.
            </p>
          </div>
        </div>
      </div>

      {/* Strategic Overview */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-8 border-2 border-blue-700">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              How do you want to be the most successful manager?
            </h2>
            <p className="text-lg text-gray-200 font-semibold mb-4">
              "How many robots should I build?"
            </p>
            <p className="text-gray-200 leading-relaxed">
              This single decision shapes your entire strategy. It affects which facilities you need, 
              how you allocate your budget, what weapons you buy, and how you progress through the game. 
              This tutorial will guide you through understanding these strategic implications before you 
              commit your starting budget of <span className="font-semibold text-blue-400">₡3,000,000</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Strategic Overview Illustration */}
      <div className="flex justify-center">
        <img 
          src="/assets/onboarding/strategic-overview.png" 
          alt="Strategic overview showing how roster size affects facility priorities, budget allocation, and battle strategy"
          className="max-w-2xl w-full rounded-lg shadow-lg"
          loading="lazy"
          onError={(e) => {
            // Fallback if image doesn't exist yet
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* What You'll Learn */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-md border border-gray-700">
        <h3 className="text-xl font-bold text-gray-100 mb-4">
          What You'll Learn in This Tutorial
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Welcome & Overview</h4>
              <p className="text-sm text-gray-400">Understanding the strategic landscape</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Roster Strategy</h4>
              <p className="text-sm text-gray-400">Choose 1, 2, or 3 robots</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Facility Planning</h4>
              <p className="text-sm text-gray-400">Which facilities to buy and when</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-300 font-bold">
              4
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Budget Allocation</h4>
              <p className="text-sm text-gray-400">How to spend your ₡3,000,000</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center text-red-600 dark:text-red-300 font-bold">
              5
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Create Your Robot</h4>
              <p className="text-sm text-gray-400">Build your first combat robot</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold">
              6
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Weapon & Loadout</h4>
              <p className="text-sm text-gray-400">Understanding weapon configurations</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-300 font-bold">
              7
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Purchase Weapons</h4>
              <p className="text-sm text-gray-400">Equip your robot for battle</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center text-teal-600 dark:text-teal-300 font-bold">
              8
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Battle Readiness</h4>
              <p className="text-sm text-gray-400">Repair costs and preparation</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 md:col-span-2">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-300 font-bold">
              9
            </div>
            <div>
              <h4 className="font-semibold text-gray-100">Complete Setup</h4>
              <p className="text-sm text-gray-400">Review your strategy and get personalized recommendations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Principles */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-r-lg">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-2">
              Remember: You Can Only Spend Your Money Once
            </h3>
            <p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">
              Every credit you spend on one thing is a credit you can't spend on something else. 
              This tutorial will help you understand the trade-offs and make informed decisions 
              that align with your chosen strategy. Don't worry—if you make mistakes, you can 
              reset your account and start over!
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Step 1 of 9
        </div>
        
        <button
          onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 flex items-center space-x-2 min-h-[44px]"
          aria-label="Next step: Roster Strategy Selection"
        >
          <span>Let's Get Started</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default React.memo(Step1_Welcome);
