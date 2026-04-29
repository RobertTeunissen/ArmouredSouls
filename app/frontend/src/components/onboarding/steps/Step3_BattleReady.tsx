/**
 * Step 6: Get Robots Battle-Ready
 * Per-robot wizard: loadout → stance → range → main weapon → offhand (if needed)
 */
import { useState, useEffect, memo } from 'react';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import LoadoutSelector from '../../LoadoutSelector';
import StanceSelector from '../../StanceSelector';
import apiClient from '../../../utils/apiClient';
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../../../../shared/utils/discounts';
import { getWeaponImagePath } from '../../../utils/weaponImages';
import { ATTRIBUTE_LABELS } from '../../../utils/weaponConstants';
import RobotImageSelector from '../../RobotImageSelector';

type LT = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type RB = 'melee' | 'short' | 'mid' | 'long';
type Phase = 'loadout' | 'stance' | 'range' | 'weapon' | 'offhand' | 'portrait' | 'done';
interface Robot { id: number; name: string; mainWeaponId: number | null; loadoutType: string; stance: string }
interface Weapon { id: number; name: string; cost: number; baseDamage: number; cooldown: number; weaponType: string; handsRequired: string; rangeBand: string; loadoutType: string; [key: string]: unknown }

const RANGES: { id: RB; icon: string; label: string; desc: string }[] = [
  { id: 'melee', icon: '🗡️', label: 'Melee', desc: 'Swords, knives, hammers' },
  { id: 'short', icon: '🔫', label: 'Short', desc: 'Pistols, blasters' },
  { id: 'mid', icon: '🎯', label: 'Mid', desc: 'Rifles, shotguns' },
  { id: 'long', icon: '🔭', label: 'Long', desc: 'Snipers, railguns' },
];
const fmt = (n: number) => `₡${n.toLocaleString()}`;
function shuf<T>(a: T[]): T[] { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function priceTier(rc: number, ws: boolean) {
  if (rc>=3) return ws?{min:150000,max:300000}:{min:50000,max:150000};
  if (rc>=2) return ws?{min:300000,max:999999}:{min:150000,max:300000};
  return ws?{min:375000,max:999999}:{min:300000,max:999999};
}

const Step6 = memo(({onPrevious:_p}:{onNext?:()=>void;onPrevious?:()=>void}) => {
  const {tutorialState,refreshState} = useOnboarding();
  const hasWS = tutorialState?.choices?.facilitiesPurchased?.includes('weapons_workshop')??false;

  const [allWeapons,setAllWeapons] = useState<Weapon[]>([]);
  const [wsLevel,setWsLevel] = useState(0);
  const [dataReady,setDataReady] = useState(false);
  const [robots,setRobots] = useState<Robot[]>([]);
  const [idx,setIdx] = useState(0);
  const [phase,setPhase] = useState<Phase>('loadout');
  const [lt,setLt] = useState<LT|null>(null);
  const [stance,setStance] = useState('');
  const [rng,setRng] = useState<RB|null>(null);
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState<string|null>(null);
  const [revert,setRevert] = useState(false);
  const [tuningCallout,setTuningCallout] = useState(false);
  const [selectedMainWeapon,setSelectedMainWeapon] = useState<Weapon|null>(null);

  const bot = robots[idx]??null;
  const done = phase==='done';
  const needsOff = lt==='weapon_shield'||lt==='dual_wield';

  useEffect(()=>{
    let cancelled = false;
    const load = async () => {
      try {
        // 1. Weapons — exactly like WeaponShopPage
        const wRes = await apiClient.get('/api/weapons');
        if (cancelled) return;
        const weapons = Array.isArray(wRes.data)
          ? (wRes.data as Weapon[]).filter(w => w.name !== 'Basic Laser' && w.cost >= 10000)
          : [];
        setAllWeapons(weapons);

        // 2. Facilities
        try {
          const fRes = await apiClient.get('/api/facilities');
          if (!cancelled) {
            const facs = fRes.data.facilities || fRes.data;
            const ws = Array.isArray(facs) ? facs.find((f:{type:string})=>f.type==='weapons_workshop') : null;
            setWsLevel(ws?.currentLevel||0);
          }
        } catch {/* ok */}

        // 3. Robots
        const rRes = await apiClient.get('/api/robots');
        if (cancelled) return;
        const all = rRes.data as Robot[];
        const need = all.filter(r=>!r.mainWeaponId);
        setRobots(need.length?need:all);
        if (!need.length && all.length) setPhase('done');
      } catch(e) {
        if (!cancelled) setErr(`Load failed: ${e instanceof Error?e.message:String(e)}`);
      } finally {
        if (!cancelled) setDataReady(true);
      }
    };
    load();
    return ()=>{cancelled=true;};
  },[]);

  const discPct = calculateWeaponWorkshopDiscount(wsLevel);
  const disc = (c:number) => applyDiscount(c,discPct);

  const pickWeapons = (hands:string, range:RB) => {
    const t = priceTier(robots.length,hasWS);
    let p = allWeapons.filter(w=>w.handsRequired===hands&&w.rangeBand===range&&w.cost>=t.min&&w.cost<=t.max);
    if(!p.length) p = allWeapons.filter(w=>w.handsRequired===hands&&w.cost>=t.min&&w.cost<=t.max);
    if(!p.length) p = allWeapons.filter(w=>w.handsRequired===hands&&w.cost<=t.max);
    return shuf(p).slice(0,3);
  };
  const pickShields = () => {
    const t = priceTier(robots.length,hasWS);
    let p = allWeapons.filter(w=>w.handsRequired==='shield'&&w.cost>=t.min&&w.cost<=t.max);
    if(!p.length) p = allWeapons.filter(w=>w.handsRequired==='shield'&&w.cost<=t.max);
    if(!p.length) p = allWeapons.filter(w=>w.handsRequired==='shield');
    return shuf(p).slice(0,3);
  };

  const mainPicks = (lt&&rng) ? pickWeapons(lt==='two_handed'?'two':'one', rng) : [];
  const offPicks = (lt&&rng) ? (lt==='weapon_shield'?pickShields():pickWeapons('one',rng)) : [];

  const nextBot = () => { const n=idx+1; if(n>=robots.length) setPhase('done'); else {setIdx(n);setPhase('loadout');setLt(null);setStance('');setRng(null);setSelectedMainWeapon(null);setTuningCallout(false);} };

  const buyEquip = async (wId:number,rId:number,slot:'main'|'offhand') => {
    try {
      const r = await apiClient.post('/api/weapon-inventory/purchase',{weaponId:wId});
      const inv = r.data.weaponInventory.id;
      if(slot==='main') await apiClient.put(`/api/robots/${rId}/equip-main-weapon`,{weaponInventoryId:inv});
      else await apiClient.put(`/api/robots/${rId}/equip-offhand-weapon`,{weaponInventoryId:inv});
    } catch (e: unknown) {
      const msg = (e as {response?:{data?:{error?:string}}})?.response?.data?.error || '';
      if (msg === 'Storage capacity full') {
        // Auto-buy Storage Facility upgrade and retry
        await apiClient.post('/api/facilities/upgrade', { facilityType: 'storage_facility' });
        const r = await apiClient.post('/api/weapon-inventory/purchase',{weaponId:wId});
        const inv = r.data.weaponInventory.id;
        if(slot==='main') await apiClient.put(`/api/robots/${rId}/equip-main-weapon`,{weaponInventoryId:inv});
        else await apiClient.put(`/api/robots/${rId}/equip-offhand-weapon`,{weaponInventoryId:inv});
      } else {
        throw e;
      }
    }
  };

  /**
   * Auto-allocate 10 tuning points proportionally into the same attributes
   * the equipped weapon boosts. Called after the final weapon is equipped.
   */
  const autoAllocateTuning = async (weapon: Weapon, robotId: number) => {
    try {
      // Collect non-zero weapon bonuses and map bonus keys to tuning attribute keys
      const bonusEntries: { attr: string; value: number }[] = [];
      const allBonusKeys = [
        'combatPowerBonus', 'targetingSystemsBonus', 'criticalSystemsBonus',
        'penetrationBonus', 'weaponControlBonus', 'attackSpeedBonus',
        'armorPlatingBonus', 'shieldCapacityBonus', 'evasionThrustersBonus',
        'damageDampenersBonus', 'counterProtocolsBonus', 'hullIntegrityBonus',
        'servoMotorsBonus', 'gyroStabilizersBonus', 'hydraulicSystemsBonus',
        'powerCoreBonus', 'combatAlgorithmsBonus', 'threatAnalysisBonus',
        'adaptiveAIBonus', 'logicCoresBonus', 'syncProtocolsBonus',
        'supportSystemsBonus', 'formationTacticsBonus',
      ];
      for (const bonusKey of allBonusKeys) {
        const v = Number(weapon[bonusKey]) || 0;
        if (v > 0) {
          // Strip 'Bonus' suffix to get the tuning attribute key
          const attr = bonusKey.replace(/Bonus$/, '');
          bonusEntries.push({ attr, value: v });
        }
      }
      if (bonusEntries.length === 0) return;

      // Distribute 10 points proportionally
      const totalBonus = bonusEntries.reduce((s, e) => s + e.value, 0);
      const TUNING_POINTS = 10;
      const rawAllocations = bonusEntries.map(e => ({
        attr: e.attr,
        value: (e.value / totalBonus) * TUNING_POINTS,
      }));

      // Round to 2 decimal places, then adjust to ensure sum is exactly 10
      const rounded = rawAllocations.map(a => ({
        attr: a.attr,
        value: Math.round(a.value * 100) / 100,
      }));
      const roundedSum = rounded.reduce((s, a) => s + a.value, 0);
      const diff = Math.round((TUNING_POINTS - roundedSum) * 100) / 100;
      if (diff !== 0 && rounded.length > 0) {
        // Add the rounding remainder to the largest allocation
        const largest = rounded.reduce((max, a) => a.value > max.value ? a : max, rounded[0]);
        largest.value = Math.round((largest.value + diff) * 100) / 100;
      }

      const allocations: Record<string, number> = {};
      for (const a of rounded) {
        if (a.value > 0) allocations[a.attr] = a.value;
      }

      await apiClient.put(`/api/robots/${robotId}/tuning-allocation`, allocations);
      setTuningCallout(true);
    } catch {
      // Non-critical — don't block onboarding if tuning auto-allocation fails
      console.warn('[Step6] Auto-tuning allocation failed, continuing onboarding');
    }
  };

  const onMain = async (w:Weapon) => {
    if(!bot||!lt) return;
    try { setBusy(true);setErr(null); await buyEquip(w.id,bot.id,'main'); setSelectedMainWeapon(w); if(needsOff) setPhase('offhand'); else { await autoAllocateTuning(w,bot.id); setPhase('portrait'); } }
    catch(e:unknown){setErr((e as {response?:{data?:{error?:string}}})?.response?.data?.error||'Something went wrong.');}
    finally{setBusy(false);}
  };
  const onOff = async (w:Weapon) => {
    if(!bot) return;
    try { setBusy(true);setErr(null); await buyEquip(w.id,bot.id,'offhand'); if(selectedMainWeapon) await autoAllocateTuning(selectedMainWeapon,bot.id); setPhase('portrait'); }
    catch(e:unknown){setErr((e as {response?:{data?:{error?:string}}})?.response?.data?.error||'Something went wrong.');}
    finally{setBusy(false);}
  };
  const onFinish = async () => {
    try { setBusy(true);setErr(null); await apiClient.post('/api/onboarding/state',{step:7}); await apiClient.post('/api/onboarding/state',{step:8}); await refreshState(); }
    catch(e:unknown){setErr((e as {response?:{data?:{error?:string}}})?.response?.data?.error||'Something went wrong.');}
    finally{setBusy(false);}
  };
  const onRevert = async () => {
    try { setBusy(true);setErr(null); await apiClient.post('/api/onboarding/reset-account',{confirmation:'RESET',reason:'Previous from battle-ready'}); await refreshState(); }
    catch(e:unknown){setErr((e as {response?:{data?:{error?:string}}})?.response?.data?.error||'Could not revert.');}
    finally{setBusy(false);setRevert(false);}
  };

  const wCard = (w:Weapon, onClick:()=>void) => {
    const dps = w.cooldown>0?(w.baseDamage/w.cooldown).toFixed(1):'—';
    const sh = w.handsRequired==='shield';
    const price = disc(w.cost);
    return (<button key={w.id} type="button" disabled={busy} onClick={onClick}
      className={`relative border rounded-lg overflow-hidden text-left transition-all duration-150 hover:-translate-y-0.5 border-gray-600 bg-gradient-to-br from-gray-700 to-gray-750 hover:border-gray-500 hover:shadow-md ${busy?'opacity-50 cursor-wait':'cursor-pointer'}`}>
      <div className="flex">
        <img src={getWeaponImagePath(w.name)} alt={w.name} className="w-40 self-stretch object-cover flex-shrink-0" />
        <div className="p-3 flex-1 min-w-0">
          <h4 className="font-bold text-sm text-gray-100">{w.name}</h4>
          <p className="text-xs text-secondary mb-2 capitalize">{w.weaponType} · {w.rangeBand}</p>
      {!sh?(<div className="flex gap-3 text-xs border-t border-gray-600 pt-2 mt-2">
        <span className="text-secondary">Dmg <span className="font-bold text-gray-100">{w.baseDamage}</span></span>
        <span className="text-secondary">Spd <span className="font-bold text-gray-100">{w.cooldown}s</span></span>
        <span className="text-secondary">DPS <span className="font-bold text-primary">{dps}</span></span>
      </div>):(<div className="text-xs text-secondary border-t border-gray-600 pt-2 mt-2">Defensive shield</div>)}
      {(() => { const bonuses = ATTRIBUTE_LABELS.filter(a => (w[a.key] as number) !== 0); return bonuses.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs">
          {bonuses.map(a => { const v = w[a.key] as number; return (
            <span key={a.key} className={v > 0 ? 'text-success' : 'text-error'}>{a.label} {v > 0 ? '+' : ''}{v}</span>
          ); })}
        </div>) : null; })()}
      <div className="mt-2"><span className="text-primary font-semibold text-sm">{fmt(price)}</span>
        {price<w.cost&&<span className="text-xs text-secondary line-through ml-2">{fmt(w.cost)}</span>}</div>
        </div>
      </div>
    </button>);
  };

  const backBtn = (label:string,onClick:()=>void) => (
    <div className="text-center mt-4"><button onClick={onClick} className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px]">{label}</button></div>);
  const nextBtn = (enabled:boolean,onClick:()=>void) => (
    <div className="text-center mt-6"><button onClick={onClick} disabled={!enabled||busy}
      className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 min-h-[44px] ${enabled&&!busy?'bg-primary hover:bg-blue-700 text-white shadow-lg':'bg-surface-elevated text-secondary cursor-not-allowed'}`}>Next</button></div>);

  if (!dataReady) return <div className="text-center py-16 text-secondary">Loading…</div>;
  const prog = robots.length>1&&!done ? `Robot ${idx+1} of ${robots.length}` : null;

  return (<div className="max-w-4xl mx-auto px-4 py-8">
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold mb-3 text-gray-100">{done?'All Robots Battle-Ready!':'Get Your Robots Battle-Ready'}</h1>
      {!done&&bot&&<p className="text-lg text-secondary">Configure <span className="text-primary font-semibold">{bot.name}</span>{prog&&<span className="text-tertiary"> — {prog}</span>}</p>}
    </div>
    {err&&<div className="bg-red-900/30 border border-red-700 rounded-lg p-3 max-w-lg mx-auto mb-6"><p className="text-error text-sm text-center">{err}</p></div>}

    {phase==='loadout'&&bot&&<div className="max-w-2xl mx-auto">
      <LoadoutSelector robotId={bot.id} currentLoadout={lt||''} onLoadoutChange={v=>{if(!busy)setLt(v as LT);}} />
      {nextBtn(!!lt,()=>setPhase('stance'))}
    </div>}

    {phase==='stance'&&bot&&<div className="max-w-2xl mx-auto">
      <StanceSelector robotId={bot.id} currentStance={stance} onStanceChange={v=>setStance(v)} />
      {nextBtn(!!stance,()=>setPhase('range'))}
      {backBtn('← Change loadout',()=>{setPhase('loadout');setLt(null);setStance('');})}
    </div>}

    {phase==='range'&&<div className="max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-3 text-secondary uppercase tracking-wide">Preferred Range</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{RANGES.map(r=>(<div key={r.id} onClick={()=>{if(!busy)setRng(r.id);}}
        className={`border rounded-lg p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${rng===r.id?'border-blue-500 bg-blue-900/30 ring-2 ring-blue-500 shadow-lg':'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-750 hover:border-gray-500 hover:shadow-md'}`}>
        <div className="text-center mb-2"><span className="text-4xl">{r.icon}</span></div>
        <h4 className="font-bold text-base text-center mb-1">{r.label}</h4>
        <p className="text-xs text-secondary text-center">{r.desc}</p></div>))}</div>
      {nextBtn(!!rng,()=>setPhase('weapon'))}
      {backBtn('← Change stance',()=>{setPhase('stance');setRng(null);})}
    </div>}

    {phase==='weapon'&&<div>
      <h3 className="text-lg font-semibold mb-1 text-secondary uppercase tracking-wide">Choose Your {needsOff?'Main ':''}Weapon</h3>
      <p className="text-sm text-secondary mb-4">{needsOff?"You'll pick your offhand next.":'Pick a weapon for your robot.'}</p>
      {mainPicks.length===0
        ?<div className="text-center py-8 text-warning">No weapons found ({allWeapons.length} loaded). Try a different range or loadout.</div>
        :<div className={`grid grid-cols-1 ${mainPicks.length>=3?'md:grid-cols-3':mainPicks.length===2?'md:grid-cols-2':''} gap-4`}>{mainPicks.map(w=>wCard(w,()=>onMain(w)))}</div>}
      {backBtn('← Change range',()=>setPhase('range'))}
    </div>}

    {phase==='offhand'&&<div>
      <h3 className="text-lg font-semibold mb-1 text-secondary uppercase tracking-wide">Choose Your {lt==='weapon_shield'?'Shield':'Offhand Weapon'}</h3>
      <p className="text-sm text-secondary mb-4">{lt==='weapon_shield'?'Pick a shield.':'Pick a second weapon for your offhand.'}</p>
      {offPicks.length===0
        ?<div className="text-center py-8 text-warning">No offhand options found.</div>
        :<div className={`grid grid-cols-1 ${offPicks.length>=3?'md:grid-cols-3':offPicks.length===2?'md:grid-cols-2':''} gap-4`}>{offPicks.map(w=>wCard(w,()=>onOff(w)))}</div>}
      {backBtn('← Change main weapon',()=>setPhase('weapon'))}
    </div>}

    {phase==='portrait'&&bot&&<div>
      {tuningCallout&&<div className="bg-teal-900/20 border border-teal-700 rounded-lg p-4 max-w-2xl mx-auto mb-6">
        <p className="text-teal-400 text-sm text-center">⚙️ Your engineering team has tuned your robot to complement its weapon loadout. You can adjust your tuning before every battle on the Tuning tab.</p>
      </div>}
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-secondary uppercase tracking-wide">
          Choose a Portrait for {bot.name}
        </h3>
        {robots.length>1&&<p className="text-sm text-tertiary">Robot {idx+1} of {robots.length}</p>}
      </div>
      <RobotImageSelector
        isOpen={true}
        currentImageUrl={null}
        onSelect={async (imageUrl:string)=>{
          try {
            setBusy(true);setErr(null);
            await apiClient.put(`/api/robots/${bot.id}/appearance`,{imageUrl});
            nextBot();
          } catch(e:unknown){setErr((e as {response?:{data?:{error?:string}}})?.response?.data?.error||'Failed to set image.');}
          finally{setBusy(false);}
        }}
        onClose={()=>nextBot()}
      />
    </div>}

    {done&&<div className="text-center">
      <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 mb-8 max-w-lg mx-auto"><span className="text-4xl block mb-3">✅</span>
        <h2 className="text-xl font-bold text-success mb-2">{robots.length===1?'Your robot is':'All your robots are'} battle-ready!</h2>
        <p className="text-secondary text-sm">Loadout, stance, and weapons configured.</p></div>
      <button onClick={onFinish} disabled={busy} className="px-8 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg transition-all duration-200 disabled:opacity-50 min-h-[44px]">{busy?'Loading...':'Continue'}</button>
    </div>}

    <div className="flex justify-center mt-8"><button onClick={()=>setRevert(true)} disabled={busy} className="px-6 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50">Previous</button></div>

    {revert&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" role="dialog" aria-modal="true"><div className="bg-surface border border-white/10 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
      <h2 className="text-xl font-bold text-gray-100 mb-3">Go Back to Strategy Selection?</h2>
      <p className="text-secondary text-sm mb-5">This will undo all progress — robots, weapons, facilities reverted, credits restored to ₡3,000,000.</p>
      <div className="flex gap-3 justify-end">
        <button onClick={()=>setRevert(false)} disabled={busy} className="px-5 py-2.5 border border-primary text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors min-h-[44px] disabled:opacity-50">Cancel</button>
        <button onClick={onRevert} disabled={busy} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors min-h-[44px] disabled:opacity-50">{busy?'Reverting...':'Yes, Start Over'}</button>
      </div></div></div>}
  </div>);
});
Step6.displayName='Step6_WeaponEducation';
export default Step6;
