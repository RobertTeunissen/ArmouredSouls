import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { onActivationKey } from '../keyboardActivation';

function keyEvent(key: string): KeyboardEvent<HTMLElement> & { preventDefault: ReturnType<typeof vi.fn> } {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLElement> & {
    preventDefault: ReturnType<typeof vi.fn>;
  };
}

describe('onActivationKey', () => {
  it.each(['Enter', ' '])('runs the action and prevents the default for %j', (key) => {
    const action = vi.fn();
    const event = keyEvent(key);
    onActivationKey(action)(event);
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it.each(['Tab', 'Escape', 'a', 'ArrowDown'])('ignores %j', (key) => {
    const action = vi.fn();
    const event = keyEvent(key);
    onActivationKey(action)(event);
    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
