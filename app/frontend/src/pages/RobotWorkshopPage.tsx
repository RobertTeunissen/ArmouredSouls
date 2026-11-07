/**
 * Robot Workshop (`/robots/:id/prepare`, #504): the owner's preparation page.
 *
 * Two sections replace six owner tabs: Build (attribute upgrades, tuning and
 * effective stats in one table) and Loadout (weapons, stance, yield). A
 * robot switcher and "Save · next robot" let a stable be prepared without
 * going back to the robots list; repairs sit in the header.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BattleConfigTab from '../components/BattleConfigTab';
import ConfirmationModal from '../components/ConfirmationModal';
import RobotImageSelector from '../components/RobotImageSelector';
import Toast from '../components/Toast';
import RobotEligibilityChecklist from '../components/robot-setup/RobotEligibilityChecklist';
import { BuildTable } from '../components/robot-workshop/BuildTable';
import { InBattlePanel } from '../components/robot-workshop/InBattlePanel';
import { RobotSwitcher } from '../components/robot-workshop/RobotSwitcher';
import { StatusBar } from '../components/robot-workshop/StatusBar';
import { WorkshopHeader } from '../components/robot-workshop/WorkshopHeader';
import { useWorkshopBuild } from '../components/robot-workshop/useWorkshopBuild';
import { useRobotProfile } from '../components/robot-profile/useRobotProfile';
import { isOwnerRobotDetail, useRobotDetail } from '../hooks/useRobotDetail';
import { useAuth } from '../contexts/AuthContext';
import { useRobotStore } from '../stores';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { repairAllRobots } from '../utils/robotApi';
import { applyManualRepairDiscount, calculateRepairQuote } from '@shared/utils/repairCost';
import { formatLoadoutName } from '../utils/robotStats';
import { liveModeCells, tierSummary } from '../utils/stableViewFormat';
import { ALL_ATTRIBUTES, weaponBonuses, type AttributeValues } from '../utils/workshopBuild';
import { workshopPath, type WorkshopSection } from '../utils/robotRoutes';

function manualRepairCost(robot: { currentHP: number; maxHP: number }, repairBayLevel: number): number {
  if (robot.maxHP <= 0 || robot.currentHP >= robot.maxHP) return 0;
  return applyManualRepairDiscount(calculateRepairQuote({ robot }, repairBayLevel));
}

function RobotWorkshop() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section: WorkshopSection = params.get('section') === 'loadout' ? 'loadout' : 'build';
  const detail = useRobotDetail();
  const { robot, weapons, currency, loading, isOwner, isOnboarding, trainingLevel, rosterCapacity, repairBayLevel, academyLevels } = detail;
  const { refreshUser } = useAuth();
  const stableRobots = useRobotStore((s) => s.robots);
  const fetchRobots = useRobotStore((s) => s.fetchRobots);
  const { profile } = useRobotProfile(robot?.id);
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const ownerRobot = robot && isOwner && isOwnerRobotDetail(robot) ? robot : null;
  const values = useMemo(
    () => Object.fromEntries(ALL_ATTRIBUTES.map(({ key }) => [key, Number(robot?.[key] ?? 0)])) as AttributeValues,
    [robot],
  );
  const costs = useMemo(() => ({ trainingLevel, rosterCapacity }), [trainingLevel, rosterCapacity]);
  const build = useWorkshopBuild({
    robotId: robot?.id ?? 0, values, academyLevels, costs, credits: currency, commitUpgrades: detail.handleCommitUpgrades,
  });

  // Booked events for the unequip confirmation.
  const robotId = robot?.id;
  const heldSlots = useSubscriptionStore((s) => s.overview?.robots.find((r) => r.robotId === robotId)?.heldSlots);
  const registeredEvents = useSubscriptionStore((s) => s.overview?.registeredEvents);
  const heldEvents = useMemo(
    () => (heldSlots ?? []).map((slot) => registeredEvents?.find((e) => e.type === slot)?.label ?? slot),
    [heldSlots, registeredEvents],
  );
  useEffect(() => {
    if (isOwner) void useSubscriptionStore.getState().fetchOverview();
  }, [isOwner]);

  const summary = useMemo(() => (profile ? tierSummary(liveModeCells(profile.standings)) : null), [profile]);
  const bonuses = useMemo(() => weaponBonuses([ownerRobot?.mainWeapon, ownerRobot?.offhandWeapon]), [ownerRobot?.mainWeapon, ownerRobot?.offhandWeapon]);
  const switcherRobots = useMemo(() => stableRobots.map((r) => ({ id: r.id, name: r.name })), [stableRobots]);
  const repairAllCost = useMemo(
    () => stableRobots.reduce((sum, r) => sum + manualRepairCost(r, repairBayLevel), 0),
    [stableRobots, repairBayLevel],
  );
  const damagedCount = stableRobots.filter((r) => r.currentHP < r.maxHP).length;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white"><div className="text-xl">Loading workshop…</div></div>;
  }
  if (!robot) return <Navigate to="/robots" replace />;
  if (!isOwner) return <Navigate to={`/robots/${robot.id}`} replace />;
  if (!ownerRobot) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-white" role="alert" data-testid="owner-details-unavailable">
        <p className="text-lg text-secondary">Robot details unavailable. Reload the page to try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-[44px] rounded bg-primary px-6 py-2">Reload</button>
      </div>
    );
  }

  const index = switcherRobots.findIndex((r) => r.id === robot.id);
  const next = switcherRobots.length > 1 && index >= 0 ? switcherRobots[(index + 1) % switcherRobots.length] : null;
  const confirmLeave = (): boolean => !build.hasChanges || window.confirm('You have unsaved changes for this robot. Leave without saving?');
  const goNext = (): void => { if (next && confirmLeave()) navigate(workshopPath(next.id, section)); };
  const setSection = (s: WorkshopSection): void => {
    const nextParams = new URLSearchParams(params);
    if (s === 'loadout') nextParams.set('section', 'loadout'); else nextParams.delete('section');
    setParams(nextParams, { replace: true });
  };
  const save = async (): Promise<void> => {
    const ok = await build.save();
    if (!ok) {
      detail.setToast({ message: 'Saving failed. Nothing after the failed step was saved; please try again.', type: 'error' });
      return;
    }
    detail.setToast({ message: `${robot.name} saved.`, type: 'success' });
    if (next) navigate(workshopPath(next.id, section));
  };
  const repairAll = async (): Promise<void> => {
    setConfirmRepair(false);
    setRepairing(true);
    try {
      await repairAllRobots();
      await Promise.all([fetchRobots(), refreshUser(), detail.reload()]);
      detail.setToast({ message: 'All damaged robots repaired.', type: 'success' });
    } catch {
      detail.setToast({ message: 'Repair failed. Please try again.', type: 'error' });
    } finally {
      setRepairing(false);
    }
  };

  const gear = [
    [ownerRobot.mainWeapon?.weapon.name, ownerRobot.offhandWeapon?.weapon.name].filter(Boolean).join(' + ') || 'No weapon',
    formatLoadoutName(ownerRobot.loadoutType),
    `${ownerRobot.stance.charAt(0).toUpperCase()}${ownerRobot.stance.slice(1)}`,
    `Yield ${ownerRobot.yieldThreshold}%`,
  ].join(' · ');

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto space-y-5 px-4 py-6 pb-56 sm:pb-44 lg:pb-32">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/robots" className="inline-flex min-h-[44px] items-center text-primary hover:underline">← Robots</Link>
          <RobotSwitcher robots={switcherRobots} currentId={robot.id} section={section} confirmLeave={confirmLeave} />
          <Link to={`/robots/${robot.id}`} className="inline-flex min-h-[44px] items-center text-primary hover:underline">Public profile →</Link>
        </div>

        {isOnboarding && (
          <div className="rounded-lg border border-info/40 bg-info/10 p-4" role="region" aria-label="Onboarding guidance" data-testid="onboarding-banner">
            <div className="flex flex-wrap items-start gap-3">
              <p className="flex-1 text-sm"><span className="font-semibold text-info">Tutorial: Equip your weapon.</span>{' '}
                <span className="text-secondary">Open Loadout and equip the weapon you bought. Once equipped, your robot is battle-ready.</span></p>
              <button type="button" onClick={() => navigate('/onboarding')} className="min-h-[44px] text-sm text-secondary hover:text-white" data-testid="return-to-tutorial">
                Return to Tutorial
              </button>
            </div>
          </div>
        )}

        <WorkshopHeader
          name={robot.name}
          imageUrl={robot.imageUrl}
          elo={robot.elo}
          summary={summary}
          gear={gear}
          currentHP={ownerRobot.currentHP}
          maxHP={robot.maxHP}
          currentShield={ownerRobot.currentShield}
          maxShield={robot.maxShield}
          repairCost={manualRepairCost({ currentHP: ownerRobot.currentHP, maxHP: robot.maxHP, ...values }, repairBayLevel)}
          repairAllCost={repairAllCost}
          damagedCount={damagedCount}
          onRepairAll={() => setConfirmRepair(true)}
          repairing={repairing}
          onEditImage={() => detail.setShowImageSelector(true)}
        />

        {detail.error && <p className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{detail.error}</p>}
        {detail.successMessage && <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success" role="status">{detail.successMessage}</p>}

        <RobotEligibilityChecklist robotId={robot.id} showRecommendations />

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg bg-surface-elevated p-1" role="tablist" aria-label="Workshop section">
            {(['build', 'loadout'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                id={`${s}-tab`}
                aria-selected={section === s}
                aria-controls={`${s}-panel`}
                onClick={() => setSection(s)}
                className={`min-h-[44px] rounded-md px-6 text-sm capitalize transition-colors ${section === s ? 'bg-primary/20 font-semibold text-primary' : 'text-secondary hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary">
            {section === 'build' ? 'Upgrades, tuning and effective stats in one table.' : 'Weapons, stance and yield. Changes save as you make them.'}
          </p>
        </div>

        {section === 'build' ? (
          <section id="build-panel" role="tabpanel" aria-labelledby="build-tab" className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Build</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface-elevated px-3 py-2 text-xs">
                  <span className="text-secondary">Tuning pool </span>
                  <span className="font-semibold">{build.pool ? `${build.tuningUsed} / ${build.pool.poolSize} used` : build.tuningError ? 'unavailable' : '…'}</span>
                  {build.pool && <span className="text-secondary"> · Tuning Bay {build.pool.facilityLevel}</span>}
                </span>
                <button type="button" onClick={build.maxAll} className="min-h-[44px] rounded-md bg-primary/15 px-3 text-sm font-semibold text-primary hover:bg-primary/25 lg:min-h-[36px]">Max upgrades</button>
                <button type="button" onClick={build.resetTuning} disabled={build.tuningUsed === 0} className="min-h-[44px] rounded-md bg-surface-elevated px-3 text-sm text-secondary hover:text-white disabled:opacity-40 lg:min-h-[36px]">Reset tuning</button>
              </div>
            </div>
            <BuildTable
              values={values}
              academyLevels={academyLevels}
              plan={build.plan}
              tuning={build.tuning}
              savedTuning={build.savedTuning}
              tuningRemaining={build.tuningRemaining}
              bonuses={bonuses}
              loadoutType={ownerRobot.loadoutType}
              stance={ownerRobot.stance}
              onSetLevel={build.setLevel}
              onMaxAttribute={build.maxAttribute}
              onTuningChange={build.setTuning}
            />
            <div className="mt-5 space-y-1 border-t border-white/10 pt-4 text-xs text-secondary">
              <p><span className="font-semibold text-white">Level</span> is permanent and costs credits; the academy sets the cap.</p>
              <p><span className="font-semibold text-white">Tuning</span> is free and resets each season. Level + tuning can&apos;t exceed cap + 5, so a higher level leaves less tuning room.</p>
              <p><span className="font-semibold text-white">In battle</span> adds weapons, loadout and stance. Hover a value for the breakdown.</p>
            </div>
          </section>
        ) : (
          <section id="loadout-panel" role="tabpanel" aria-labelledby="loadout-tab" className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <BattleConfigTab
              robot={ownerRobot}
              weapons={weapons}
              repairBayLevel={repairBayLevel}
              onRobotUpdate={detail.handleRobotUpdate}
              onEquipWeapon={detail.handleEquipWeapon}
              onUnequipWeapon={detail.handleUnequipWeapon}
              heldEvents={heldEvents}
              showStatus={false}
            />
            <div className="xl:sticky xl:top-20 xl:self-start">
              <InBattlePanel
                values={values}
                tuning={build.savedTuning}
                bonuses={bonuses}
                loadoutType={ownerRobot.loadoutType}
                stance={ownerRobot.stance}
                maxHP={robot.maxHP}
                maxShield={robot.maxShield}
              />
            </div>
          </section>
        )}
      </div>

      {/* Loadout saves as you go; the bar only matters there with unsaved Build changes. */}
      {(section === 'build' || build.hasChanges) && <StatusBar
        credits={currency}
        upgradeCost={build.upgradeCost}
        tuningUsed={build.tuningUsed}
        tuningPool={build.pool?.poolSize ?? null}
        tuningChanged={build.tuningDirty}
        hasChanges={build.hasChanges}
        saving={build.saving}
        hasNext={next !== null}
        onDiscard={build.discard}
        onSave={() => void save()}
        onNext={goNext}
      />}

      {confirmRepair && (
        <ConfirmationModal
          title="Repair all damaged robots?"
          message={`${damagedCount} ${damagedCount === 1 ? 'robot' : 'robots'} for ₡${repairAllCost.toLocaleString()}, half what the automatic repair before their next battle would cost.`}
          confirmLabel="Repair all"
          cancelLabel="Cancel"
          onConfirm={() => void repairAll()}
          onCancel={() => setConfirmRepair(false)}
        />
      )}
      <RobotImageSelector
        isOpen={detail.showImageSelector}
        currentImageUrl={robot.imageUrl}
        onSelect={detail.handleAppearanceChange}
        onClose={() => detail.setShowImageSelector(false)}
        robotId={robot.id}
      />
      {detail.toast && <Toast message={detail.toast.message} type={detail.toast.type} onClose={() => detail.setToast(null)} />}
    </div>
  );
}

/**
 * One Workshop instance per robot. Switching robots changes only the route
 * param, which would keep the mounted page (plan, tuning, the loaded robot)
 * while the next robot loads, so upgrades and tuning could reach different
 * robots. Keying on the id remounts it: the new robot starts from "Loading"
 * with empty state, and a save still in flight finishes for the robot it
 * was started for.
 */
function RobotWorkshopPage() {
  const { id } = useParams();
  return <RobotWorkshop key={id} />;
}

export default RobotWorkshopPage;
