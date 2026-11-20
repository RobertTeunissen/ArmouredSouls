/** Display helpers for weapon range bands. */
import type { RangeBand } from '@shared/types';

/** Color class for each range band (Tailwind) */
export function getRangeBandColor(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'text-red-400';
    case 'short': return 'text-yellow-400';
    case 'mid': return 'text-green-400';
    case 'long': return 'text-blue-400';
  }
}

/** Background color class for range band badges */
export function getRangeBandBgColor(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'bg-red-900/40 border-red-600';
    case 'short': return 'bg-yellow-900/40 border-yellow-600';
    case 'mid': return 'bg-green-900/40 border-green-600';
    case 'long': return 'bg-blue-900/40 border-blue-600';
  }
}

/** Human-readable label for a range band */
export function getRangeBandLabel(band: RangeBand): string {
  switch (band) {
    case 'melee': return 'Melee';
    case 'short': return 'Short';
    case 'mid': return 'Mid';
    case 'long': return 'Long';
  }
}
