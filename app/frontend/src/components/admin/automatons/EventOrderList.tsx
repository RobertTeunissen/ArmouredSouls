/**
 * Event_Order control (Spec #55, R3.5, R11.10, design §17.2, task 10.3):
 * the 9 event types numbered 1–9, each with Move up and Move down buttons of
 * 44 × 44 px named "Move up: {n} {event}". The first Move up and the last
 * Move down are disabled; after a move, focus stays on the moved row's
 * pressed button (or its other button when the pressed one became disabled).
 * Two columns at ≥ 1024 px (1–5 left, 6–9 right) with the DOM order 1–9.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './ui';
import { EVENT_LABELS } from './automatonText';

export interface EventOrderListProps {
  value: string[];
  onChange: (next: string[]) => void;
  labelledBy?: string;
}

type Direction = 'up' | 'down';

export function EventOrderList({ value, onChange, labelledBy }: EventOrderListProps): ReactNode {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<{ event: string; direction: Direction } | null>(null);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const index = value.indexOf(pending.event);
    const pressedDisabled = (pending.direction === 'up' && index === 0) || (pending.direction === 'down' && index === value.length - 1);
    const direction: Direction = pressedDisabled ? (pending.direction === 'up' ? 'down' : 'up') : pending.direction;
    buttons.current.get(`${pending.event}:${direction}`)?.focus();
  }, [value]);

  const move = (index: number, direction: Direction): void => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    pendingFocus.current = { event: value[index], direction };
    onChange(next);
  };

  const register = (key: string) => (element: HTMLButtonElement | null): void => {
    if (element) buttons.current.set(key, element);
    else buttons.current.delete(key);
  };

  return (
    <ol
      aria-label={labelledBy ? undefined : 'Event order'}
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-2 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-5"
    >
      {value.map((event, index) => {
        const label = `${index + 1} ${EVENT_LABELS[event] ?? event}`;
        return (
          <li key={event} className="flex items-center gap-2 rounded-md border border-white/10 bg-background px-2 py-1 min-w-0">
            <span className="w-6 shrink-0 text-right text-sm text-secondary">{index + 1}</span>
            <span className="flex-1 min-w-0 truncate text-sm text-white">{EVENT_LABELS[event] ?? event}</span>
            <IconButton ref={register(`${event}:up`)} label={`Move up: ${label}`} disabled={index === 0} onClick={() => move(index, 'up')}>▲</IconButton>
            <IconButton ref={register(`${event}:down`)} label={`Move down: ${label}`} disabled={index === value.length - 1} onClick={() => move(index, 'down')}>▼</IconButton>
          </li>
        );
      })}
    </ol>
  );
}
