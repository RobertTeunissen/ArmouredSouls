import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { AttributeTooltipProps } from './types';
import { STAT_ATTRIBUTE_MAP, CATEGORY_COLORS, CATEGORY_LABELS } from './attributeTooltipData';
import type { AttributeEntry } from './attributeTooltipData';

/**
 * AttributeTooltip — info icon that shows which robot attributes influence a combat stat.
 *
 * Renders an ℹ️ icon that displays a tooltip on hover (desktop) or tap (mobile)
 * with two groups: "Attacker" and "Defender", listing attribute names with
 * category color coding and increase/decrease effect direction.
 *
 * Uses a portal to render the tooltip at the document body level so it is never
 * clipped by overflow containers (e.g. horizontally scrollable tables).
 */

/* ── Component ──────────────────────────────────────────────────────── */

export function AttributeTooltip({ statName }: AttributeTooltipProps) {
  const mapping = STAT_ATTRIBUTE_MAP[statName];
  if (!mapping) return null;

  const hasAttacker = mapping.attackerAttributes.length > 0;
  const hasDefender = mapping.defenderAttributes.length > 0;
  if (!hasAttacker && !hasDefender) return null;

  return <TooltipTrigger mapping={mapping} hasAttacker={hasAttacker} hasDefender={hasDefender} />;
}

/* ── Tooltip trigger + portal panel ─────────────────────────────────── */

function TooltipTrigger({
  mapping,
  hasAttacker,
  hasDefender,
}: {
  mapping: { attackerAttributes: AttributeEntry[]; defenderAttributes: AttributeEntry[]; description?: string };
  hasAttacker: boolean;
  hasDefender: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const panelWidth = panelRect.width || 224;
    const panelHeight = panelRect.height || 100;

    // Try above the trigger first
    let top = triggerRect.top - panelHeight - 6;
    // If it would go off the top, place below instead
    if (top < 8) {
      top = triggerRect.bottom + 6;
    }

    // Center horizontally on the trigger, clamp to viewport
    let left = triggerRect.left + triggerRect.width / 2 - panelWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    setStyle({ position: 'fixed', top, left });
  }, []);

  // Position on open and reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    // Defer to next frame so panelRef is mounted and has dimensions
    const raf = requestAnimationFrame(updatePosition);

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="text-tertiary hover:text-secondary transition-colors duration-150 ease-out cursor-help p-0.5 inline-flex items-center"
        onClick={() => setIsOpen(prev => !prev)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        aria-label="Show attribute info"
      >
        <span className="text-xs" aria-hidden="true">ℹ️</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="z-[9999] w-56 bg-surface-elevated border border-tertiary/30 rounded-lg shadow-lg p-2.5 text-xs"
          style={style}
          role="tooltip"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {mapping.description && (
            <div className={hasAttacker || hasDefender ? 'mb-2 text-secondary leading-relaxed' : 'text-secondary leading-relaxed'}>
              {mapping.description}
            </div>
          )}

          {hasAttacker && (
            <div className={hasDefender ? 'mb-2' : ''}>
              <div className="font-bold text-white mb-1">⚔️ Attacker</div>
              <ul className="space-y-0.5">
                {mapping.attackerAttributes.map(attr => (
                  <AttributeRow key={attr.attribute} entry={attr} />
                ))}
              </ul>
            </div>
          )}

          {hasDefender && (
            <div>
              <div className="font-bold text-white mb-1">🛡️ Defender</div>
              <ul className="space-y-0.5">
                {mapping.defenderAttributes.map(attr => (
                  <AttributeRow key={attr.attribute} entry={attr} />
                ))}
              </ul>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Attribute row ──────────────────────────────────────────────────── */

function AttributeRow({ entry }: { entry: AttributeEntry }) {
  const colorClass = CATEGORY_COLORS[entry.category];
  const categoryLabel = CATEGORY_LABELS[entry.category];
  const effectIcon = entry.effect === 'increases' ? '▲' : '▼';
  const effectColor = entry.effect === 'increases' ? 'text-success' : 'text-error';

  return (
    <li className="flex items-center gap-1.5">
      <span className={`${effectColor} text-[10px] leading-none`}>{effectIcon}</span>
      <span className={`${colorClass} font-medium`}>{entry.label}</span>
      <span className="text-tertiary ml-auto text-[10px]">{categoryLabel}</span>
    </li>
  );
}
