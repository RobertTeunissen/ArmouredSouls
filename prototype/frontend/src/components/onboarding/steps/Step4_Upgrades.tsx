/**
 * Step 8: Attribute Investment
 * Per-robot focus selection (multi-select per robot), one "Upgrade" button.
 * Spreads budget across all robots × their selected attrs until < ₡50K.
 */
import { useState, useEffect, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import RobotImage from '../../RobotImage';
import apiClient from '../../../utils/apiClient';

interface Robot { id: number; name: string; imageUrl: string | null; [key: string]: unknown }
type Focus = 'combat' | 'defense' | 'mobility' | 'ai';

const FOCUSES: { id: Focus; icon: string; label: string; attrs: string[] }[] = [
  { id: 'combat', icon: '⚔️', label: 'Combat', attrs: ['combatPower','targetingSystems','criticalSystems','penetration','weaponControl','attackSpeed'] },
  { id: 'defense', icon: '🛡️', label: 'Defense', attrs: ['armorPlating','shieldCapacity','evasionThrusters','damageDampeners','counterProtocols'] },
  { id: 'mobility', icon: '⚡', label: 'Mobility', attrs: ['hullIntegrity','servoMotors','gyroStabilizers','hydraulicSystems','powerCore'] },
  { id: 'ai', icon: '🧠', label: 'AI & Team', attrs: ['combatAlgorithms','threatAnalysis','adaptiveAI','logicCores','syncProtocols','supportSystems','formationTactics'] },
];

const fmt = (n: number) => `₡${n.toLocaleString()}`;
const RESERVE = 50_000;

/** Backend formula: cost to go from `level` to `level+1` = (level+1) × 1500, minus training discount */
function upgCost(level: number, tfLevel: number): number {
  const base = (level + 1) * 1500;
  const disc = Math.min(tfLevel * 10, 90);
  return Math.floor(base * (1 - disc / 100));
}

const Step8 = memo(({ onPrevious: _p }: { onNext?: () => void; onPrevious?: () => void }) => {
  const { refreshState } = useOnboarding();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [budget, setBudget] = useState(0);
  const [tfLevel, setTfLevel] = useState(0);
  const [phase, setPhase] = useState<'pick' | 'tagteam'>('pick');
  const [selections, setSelections] = useState<Record<number, Set<Focus>>>({});
  const [activeBot, setActiveBot] = useState<number | null>(null);
  const [reserveBot, setReserveBot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rRes, pRes, fRes] = await Promise.all([
          apiClient.get('/api/robots'),
          apiClient.get('/api/user/profile'),
          apiClient.get('/api/facilities').catch(() => ({ data: { facilities: [] } })),
        ]);
        const bots = rRes.data as Robot[];
        setRobots(bots);
        setBudget((pRes.data as { currency: number }).currency);
        const facs = fRes.data.facilities || fRes.data || [];
        const tf = Array.isArray(facs) ? facs.find((f: { type: string }) => f.type === 'training_facility') : null;
        setTfLevel(tf?.currentLevel || 0);
        const sel: Record<number, Set<Focus>> = {};
        for (const r of bots) sel[r.id] = new Set();
        setSelections(sel);
      } catch { setErr('Failed to load data.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (rid: number, f: Focus) => {
    setSelections(prev => {
      const next = { ...prev };
      const s = new Set(prev[rid] || []);
      if (s.has(f)) s.delete(f); else s.add(f);
      next[rid] = s;
      return next;
    });
  };

  const anySelected = Object.values(selections).some(s => s.size > 0);

  const doUpgrade = async () => {
    if (!anySelected) return;
    try {
      setBusy(true); setErr(null);

      // Fetch fresh robot data
      const fresh = await Promise.all(robots.map(r => apiClient.get(`/api/robots/${r.id}`).then(x => x.data)));

      // Per-robot: which attrs to upgrade
      const robotAttrs: Record<number, string[]> = {};
      for (const r of fresh) {
        const sel = selections[r.id];
        if (!sel || sel.size === 0) continue;
        robotAttrs[r.id] = FOCUSES.filter(f => sel.has(f.id)).flatMap(f => f.attrs);
      }

      // Per-robot level maps (current levels)
      const levels: Record<number, Record<string, number>> = {};
      for (const r of fresh) {
        if (!robotAttrs[r.id]) continue;
        levels[r.id] = {};
        for (const a of robotAttrs[r.id]) levels[r.id][a] = Math.floor(Number(r[a]) || 1);
      }

      // Round-robin: one level at a time per attr per robot, stop when < RESERVE
      let remaining = budget;
      let progressed = true;
      while (progressed && remaining > RESERVE) {
        progressed = false;
        for (const r of fresh) {
          if (!robotAttrs[r.id]) continue;
          for (const a of robotAttrs[r.id]) {
            const cost = upgCost(levels[r.id][a], tfLevel);
            if (cost > 0 && remaining - cost >= RESERVE && levels[r.id][a] < 10) {
              levels[r.id][a]++;
              remaining -= cost;
              progressed = true;
            }
          }
        }
      }

      // Submit upgrades per robot (only changed attrs)
      for (const r of fresh) {
        if (!robotAttrs[r.id]) continue;
        const upgrades: Record<string, { currentLevel: number; plannedLevel: number }> = {};
        for (const a of robotAttrs[r.id]) {
          const orig = Math.floor(Number(r[a]) || 1);
          if (levels[r.id][a] > orig) {
            upgrades[a] = { currentLevel: orig, plannedLevel: levels[r.id][a] };
          }
        }
        if (Object.keys(upgrades).length > 0) {
          await apiClient.post(`/api/robots/${r.id}/upgrades`, { upgrades });
        }
      }

      const p = await apiClient.get('/api/user/profile');
      setBudget((p.data as { currency: number }).currency);
      if (robots.length >= 2) setPhase('tagteam');
      else await onFinish();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upgrade failed.');
    } finally { setBusy(false); }
  };

  const onFinish = async () => {
    try { setBusy(true); setErr(null); await apiClient.post('/api/onboarding/state', { step: 9 }); await refreshState(); }
    catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-center py-16 text-secondary">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-gray-100">Upgrade Your Robots</h1>
        <p className="text-lg text-secondary">Remaining budget: <span className="text-primary font-semibold">{fmt(budget)}</span></p>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 max-w-lg mx-auto mb-6"><p className="text-error text-sm text-center">{err}</p></div>}

      {phase === 'pick' && (
        <div>
          <div className="space-y-6 mb-8">
            {robots.map(r => (
              <div key={r.id} className="border border-white/10 rounded-lg p-4 bg-surface">
                <div className="flex items-center gap-4 mb-4">
                  <RobotImage imageUrl={r.imageUrl} robotName={r.name} size="small" />
                  <h3 className="font-bold text-lg text-gray-100">{r.name}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FOCUSES.map(f => {
                    const sel = selections[r.id]?.has(f.id);
                    return (
                      <div key={f.id} onClick={() => toggle(r.id, f.id)}
                        className={`border rounded-lg p-2 cursor-pointer transition-all duration-150
                          ${sel ? 'border-blue-500 bg-blue-900/30 ring-2 ring-blue-500' : 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-750 hover:border-gray-500'}`}>
                        {sel && <div className="text-right -mb-1"><span className="bg-primary text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">✓</span></div>}
                        <div className="text-center">
                          <span className="text-2xl">{f.icon}</span>
                          <h4 className="font-semibold text-sm mt-1">{f.label}</h4>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4">
            <button onClick={doUpgrade} disabled={!anySelected || busy}
              className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px]
                ${anySelected && !busy ? 'bg-primary hover:bg-blue-700 text-white shadow-lg' : 'bg-surface-elevated text-secondary cursor-not-allowed'}`}>
              {busy ? 'Upgrading…' : 'Upgrade'}</button>
            <button onClick={() => { if (robots.length >= 2) setPhase('tagteam'); else onFinish(); }} disabled={busy}
              className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px]">
              Skip — I'll upgrade later</button>
          </div>
        </div>
      )}

      {phase === 'tagteam' && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Form a Tag Team</h2>
            <p className="text-secondary">Pick two robots to fight together in Tag Team battles. Choose who leads (Active) and who backs them up (Reserve).</p>
          </div>

          <div className="space-y-3 mb-8">
            {robots.map(r => {
              const isActive = activeBot === r.id;
              const isReserve = reserveBot === r.id;
              const assigned = isActive || isReserve;
              return (
                <div key={r.id} className={`border rounded-lg p-4 flex items-center gap-4 transition-all
                  ${assigned ? 'border-blue-500 bg-blue-900/20' : 'border-white/10 bg-surface'}`}>
                  <RobotImage imageUrl={r.imageUrl} robotName={r.name} size="small" />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-100">{r.name}</h3>
                    {isActive && <span className="text-xs text-success font-semibold">⚔️ Active</span>}
                    {isReserve && <span className="text-xs text-primary font-semibold">🛡️ Reserve</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveBot(r.id); if (reserveBot === r.id) setReserveBot(null); }}
                      disabled={busy}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[36px]
                        ${isActive ? 'bg-green-600 text-white' : 'border border-gray-600 text-secondary hover:border-gray-400'}`}>
                      Active</button>
                    <button onClick={() => { setReserveBot(r.id); if (activeBot === r.id) setActiveBot(null); }}
                      disabled={busy}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[36px]
                        ${isReserve ? 'bg-primary text-white' : 'border border-gray-600 text-secondary hover:border-gray-400'}`}>
                      Reserve</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-4">
            <button onClick={async () => {
              if (!activeBot || !reserveBot) return;
              try {
                setBusy(true); setErr(null);
                await apiClient.post('/api/tag-teams', { activeRobotId: activeBot, reserveRobotId: reserveBot });
                await onFinish();
              } catch (e: unknown) {
                setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create tag team.');
              } finally { setBusy(false); }
            }} disabled={!activeBot || !reserveBot || busy}
              className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px]
                ${activeBot && reserveBot && !busy ? 'bg-primary hover:bg-blue-700 text-white shadow-lg' : 'bg-surface-elevated text-secondary cursor-not-allowed'}`}>
              {busy ? 'Creating…' : 'Create Tag Team'}</button>
            <button onClick={onFinish} disabled={busy}
              className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px]">
              Skip</button>
          </div>
        </div>
      )}
    </div>
  );
});

Step8.displayName = 'Step8_BattleReadiness';
export default Step8;
