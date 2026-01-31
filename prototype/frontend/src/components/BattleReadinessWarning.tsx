interface BattleReadinessWarningProps {
  robot: {
    currentHP: number;
    maxHP: number;
    mainWeaponId: number | null;
    offhandWeaponId: number | null;
    loadoutType: string;
  };
}

function BattleReadinessWarning({ robot }: BattleReadinessWarningProps) {
  const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
  const isLowHP = hpPercentage < 75;
  
  const needsMainWeapon = !robot.mainWeaponId;
  const needsOffhandWeapon = robot.loadoutType === 'dual_wield' && !robot.offhandWeaponId;
  const needsWeapons = needsMainWeapon || needsOffhandWeapon;
  
  const isNotBattleReady = isLowHP || needsWeapons;
  
  if (!isNotBattleReady) {
    return null;
  }
  
  return (
    <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 mt-2">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-400">
            Not Battle Ready
          </h3>
          <div className="mt-2 text-sm text-yellow-300">
            <ul className="list-disc pl-5 space-y-1">
              {isLowHP && (
                <li>
                  Low HP: {robot.currentHP}/{robot.maxHP} ({hpPercentage.toFixed(0)}%) - Minimum 75% required
                </li>
              )}
              {needsMainWeapon && (
                <li>
                  No main weapon equipped
                </li>
              )}
              {needsOffhandWeapon && (
                <li>
                  No offhand weapon equipped (required for dual wield)
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BattleReadinessWarning;
