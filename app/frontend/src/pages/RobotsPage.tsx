import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import RobotImage from '../components/RobotImage';
import ConfirmationModal from '../components/ConfirmationModal';
import ViewModeToggle from '../components/ViewModeToggle';
import EventBadge from '../components/subscriptions/EventBadge';
import TeamMembershipChips from '../components/TeamMembershipChips';
import {
  useRobotsList,
  getHPColor,
  calculateWinRate,
  calculateReadiness,
  getReadinessStatus,
} from '../hooks/useRobotsList';

function RobotsPage() {
  const navigate = useNavigate();
  const {
    robots,
    displayedRobots,
    loading,
    error,
    subscriptionsByRobotId,
    maxRobots,
    atCapacity,
    viewMode,
    handleViewModeChange,
    sortColumn,
    sortDirection,
    handleSort,
    needsRepair,
    discountedCost,
    discount,
    showRepairConfirmation,
    repairCostInfo,
    handleRepairAll,
    confirmRepairAll,
    setShowRepairConfirmation,
    isOnboarding,
  } = useRobotsList();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e14] text-white flex items-center justify-center">
        <div className="text-xl">Loading robots...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Onboarding banner */}
        {isOnboarding && (
          <div
            className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6"
            role="region"
            aria-label="Onboarding guidance"
            data-testid="onboarding-banner"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0" aria-hidden="true">🎓</span>
              <div className="flex-1">
                <p className="text-primary font-semibold mb-1">Tutorial: Equip Your Weapon</p>
                <p className="text-secondary text-sm">
                  Select your robot below to visit its detail page. From there, go to the Battle Config tab
                  to equip the weapon you purchased. Once equipped, your robot will be battle-ready!
                </p>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="text-sm text-secondary hover:text-white transition-colors whitespace-nowrap"
                aria-label="Return to tutorial"
                data-testid="return-to-tutorial"
              >
                Return to Tutorial
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">
            My Robots <span className="text-secondary text-2xl">({robots.length}/{maxRobots})</span>
          </h2>
          <div className="flex gap-4">
            {robots.length > 0 && (
              <button
                onClick={handleRepairAll}
                disabled={!needsRepair}
                className={`px-6 py-3 rounded-lg transition-colors font-semibold ${
                  needsRepair
                    ? 'bg-[#d29922] hover:bg-[#e0a832] text-white'
                    : 'bg-surface-elevated text-secondary cursor-not-allowed'
                }`}
                title={needsRepair ? `Repair all robots for ₡${discountedCost.toLocaleString()}${discount > 0 ? ` (${discount}% off)` : ''}` : 'No repairs needed'}
              >
                🔧 Repair All{needsRepair ? `: ₡${discountedCost.toLocaleString()}${discount > 0 ? ` (${discount}% off)` : ''}` : ''}
              </button>
            )}
            <button
              onClick={() => navigate('/robots/create')}
              disabled={atCapacity}
              className={`px-6 py-3 rounded-lg transition-colors font-semibold ${
                atCapacity
                  ? 'bg-surface-elevated text-secondary cursor-not-allowed'
                  : 'bg-[#3fb950] hover:bg-[#4fc960] text-white'
              }`}
              title={atCapacity ? `Robot limit reached (${maxRobots}). Upgrade Roster Expansion facility to create more robots.` : 'Create a new robot'}
            >
              + Create New Robot
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        {robots.length > 0 && (
          <div className="flex justify-end mb-6">
            <ViewModeToggle 
              viewMode={viewMode} 
              onViewModeChange={handleViewModeChange} 
            />
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {robots.length === 0 ? (
          <div className="bg-[#1a1f29] p-12 rounded-lg text-center">
            <p className="text-xl text-secondary mb-4">You don&apos;t have any robots yet.</p>
            <p className="text-tertiary mb-6">Create your first robot to start battling!</p>
            <button
              onClick={() => navigate('/robots/create')}
              className="bg-[#3fb950] hover:bg-[#4fc960] px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              Create Your First Robot
            </button>
          </div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === 'table' && (
              <div className="bg-surface rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background">
                      <tr>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            Robot
                            {sortColumn === 'name' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('elo')}
                        >
                          <div className="flex items-center gap-1">
                            ELO
                            {sortColumn === 'elo' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('fame')}
                        >
                          <div className="flex items-center gap-1">
                            Fame
                            {sortColumn === 'fame' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('league')}
                        >
                          <div className="flex items-center gap-1">
                            League
                            {sortColumn === 'league' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('winRate')}
                        >
                          <div className="flex items-center gap-1">
                            Record
                            {sortColumn === 'winRate' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('hp')}
                        >
                          <div className="flex items-center gap-1">
                            HP
                            {sortColumn === 'hp' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('shield')}
                        >
                          <div className="flex items-center gap-1">
                            Shield
                            {sortColumn === 'shield' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-secondary">Weapons</th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('readiness')}
                        >
                          <div className="flex items-center gap-1">
                            Readiness
                            {sortColumn === 'readiness' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRobots.map((robot) => {
                        const hpPercentage = Math.round((robot.currentHP / robot.maxHP) * 100);
                        const shieldPercentage = robot.maxShield > 0 
                          ? Math.round((robot.currentShield / robot.maxShield) * 100)
                          : 0;
                        const winRate = calculateWinRate(robot.wins, robot.totalBattles);
                        const actualReadiness = calculateReadiness(robot.currentHP, robot.maxHP);
                        const readinessStatus = getReadinessStatus(
                          robot.currentHP, 
                          robot.maxHP,
                          robot.loadoutType,
                          robot.mainWeaponId,
                          robot.offhandWeaponId,
                          robot.offhandWeapon ?? null
                        );

                        return (
                          <tr 
                            key={robot.id}
                            className="border-t border-white/10 hover:bg-gray-750 transition-colors cursor-pointer"
                            onClick={() => navigate(`/robots/${robot.id}${isOnboarding ? '?onboarding=true' : ''}`)}
                          >
                            {/* Robot Name & Image */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <RobotImage
                                  imageUrl={robot.imageUrl ?? null}
                                  robotName={robot.name}
                                  size="small"
                                />
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold">{robot.name}</span>
                                  {robot.teamBattleMembers && robot.teamBattleMembers.length > 0 && (
                                    <TeamMembershipChips memberships={robot.teamBattleMembers} />
                                  )}
                                </div>
                              </div>
                            </td>
                            
                            {/* ELO */}
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#58a6ff]">{robot.elo}</span>
                            </td>
                            
                            {/* Fame */}
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#ffd700]">{robot.fame}</span>
                            </td>
                            
                            {/* League */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold capitalize">{robot.currentLeague}</span>
                                <span className="text-xs text-secondary">LP: {robot.leaguePoints}</span>
                              </div>
                            </td>
                            
                            {/* Record */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">{robot.wins}W-{robot.losses}L-{robot.draws}D</span>
                                <span className="text-xs text-secondary">{winRate}% WR</span>
                              </div>
                            </td>
                            
                            {/* HP */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-secondary">{robot.currentHP}/{robot.maxHP}</span>
                                <div className="w-24 h-2 bg-surface-elevated rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${getHPColor(robot.currentHP, robot.maxHP)}`}
                                    style={{ width: `${hpPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            
                            {/* Shield */}
                            <td className="px-4 py-3">
                              {robot.maxShield > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-secondary">{robot.currentShield}/{robot.maxShield}</span>
                                  <div className="w-24 h-2 bg-surface-elevated rounded-full overflow-hidden">
                                    <div
                                      className="h-full transition-all bg-[#58a6ff]"
                                      style={{ width: `${shieldPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-tertiary text-sm">N/A</span>
                              )}
                            </td>
                            
                            {/* Weapons */}
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                {robot.mainWeapon ? (
                                  <>
                                    <div>{robot.mainWeapon.weapon.name}</div>
                                    {robot.offhandWeapon && (
                                      <div className="text-secondary">+ {robot.offhandWeapon.weapon.name}</div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-tertiary">None</span>
                                )}
                              </div>
                            </td>
                            
                            {/* Readiness */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className={`font-semibold ${readinessStatus.color}`}>
                                  {actualReadiness}%
                                </span>
                                <span className={`text-xs ${readinessStatus.color}`}>
                                  {readinessStatus.text}
                                </span>
                              </div>
                            </td>
                            
                            {/* Actions */}
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/robots/${robot.id}${isOnboarding ? '?onboarding=true' : ''}`);
                                }}
                                className="text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
                              >
                                View Details →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedRobots.map((robot) => {
                  const hpPercentage = Math.round((robot.currentHP / robot.maxHP) * 100);
                  const shieldPercentage = robot.maxShield > 0 
                    ? Math.round((robot.currentShield / robot.maxShield) * 100)
                    : 0;
                  const winRate = calculateWinRate(robot.wins, robot.totalBattles);
                  const actualReadiness = calculateReadiness(robot.currentHP, robot.maxHP);
                  const readinessStatus = getReadinessStatus(
                    robot.currentHP, 
                    robot.maxHP,
                    robot.loadoutType,
                    robot.mainWeaponId,
                    robot.offhandWeaponId,
                    robot.offhandWeapon ?? null
                  );

                  return (
                    <div
                      key={robot.id}
                      className={`bg-[#252b38] p-6 rounded-lg border-2 border-[#3d444d] hover:border-[#58a6ff] transition-colors cursor-pointer${isOnboarding && displayedRobots.indexOf(robot) === 0 ? ' robot-card-first' : ''}${isOnboarding ? ' onboarding-robot-card' : ''}`}
                      onClick={() => navigate(`/robots/${robot.id}${isOnboarding ? '?onboarding=true' : ''}`)}
                    >
                      {/* Robot Portrait */}
                      <div className="flex justify-center mb-4">
                        <RobotImage
                          imageUrl={robot.imageUrl ?? null}
                          robotName={robot.name}
                          size="medium"
                        />
                      </div>

                      {/* Robot Info */}
                      <h3 className="text-xl font-bold mb-2 text-center">{robot.name}</h3>
                      
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-secondary">ELO:</span>
                          <span className="font-semibold text-[#58a6ff]">{robot.elo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-secondary">Fame:</span>
                          <span className="font-semibold text-[#ffd700]">{robot.fame}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-secondary">League:</span>
                          <span className="font-semibold capitalize">{robot.currentLeague} │ LP: {robot.leaguePoints}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Record:</span>
                          <span className="font-semibold">
                            {robot.wins}W-{robot.losses}L-{robot.draws}D ({winRate}%)
                          </span>
                        </div>
                      </div>

                      {/* HP Bar */}
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-xs text-secondary">
                          <span>HP</span>
                          <span>{hpPercentage}%</span>
                        </div>
                        <div className="w-full h-6 bg-[#1a1f29] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getHPColor(robot.currentHP, robot.maxHP)}`}
                            style={{ width: `${hpPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Shield Bar */}
                      {robot.maxShield > 0 && (
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-xs text-secondary">
                            <span>Shield</span>
                            <span>{shieldPercentage}%</span>
                          </div>
                          <div className="w-full h-5 bg-[#1a1f29] rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-300 bg-[#58a6ff]"
                              style={{ width: `${shieldPercentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Weapon & Readiness */}
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-secondary">Weapon:</span>
                          <span className="font-semibold">
                            {robot.mainWeapon ? robot.mainWeapon.weapon.name : 'None'}
                            {robot.offhandWeapon && ` + ${robot.offhandWeapon.weapon.name}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Readiness:</span>
                          <span className={`font-semibold ${readinessStatus.color}`}>
                            {actualReadiness}% │ {readinessStatus.text}
                            {readinessStatus.reason && ` (${readinessStatus.reason})`}
                          </span>
                        </div>
                      </div>

                      {/* Event Subscriptions */}
                      {subscriptionsByRobotId[robot.id] && subscriptionsByRobotId[robot.id].length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs text-secondary mb-1.5">Subscriptions</div>
                          <div className="flex flex-wrap gap-1.5">
                            {subscriptionsByRobotId[robot.id].map((eventType) => (
                              <EventBadge key={eventType} eventType={eventType} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* View Details Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/robots/${robot.id}${isOnboarding ? '?onboarding=true' : ''}`);
                        }}
                        className="mt-4 w-full border border-[#58a6ff] text-[#58a6ff] hover:bg-[#58a6ff] hover:bg-opacity-10 px-4 py-2 rounded transition-colors"
                      >
                        View Details →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Repair Confirmation Modal */}
      {showRepairConfirmation && (
        <ConfirmationModal
          title="Confirm Repair"
          message={
            <div>
              <p className="mb-2">
                Are you sure you want to repair all robots?
              </p>
              <div className="bg-surface-elevated p-3 rounded mt-3 space-y-2">
                {repairCostInfo.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-tertiary">Repair Bay Discount:</span>
                    <span className="text-primary">{repairCostInfo.discount}% off</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-tertiary">Manual Repair Discount:</span>
                  <span className="text-primary">50% off</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="text-secondary">Final Cost:</span>
                  <span className="text-xl font-bold text-success">
                    ₡{repairCostInfo.discountedCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          }
          confirmLabel="Repair All"
          cancelLabel="Cancel"
          onConfirm={confirmRepairAll}
          onCancel={() => setShowRepairConfirmation(false)}
        />
      )}
    </div>
  );
}

export default RobotsPage;
