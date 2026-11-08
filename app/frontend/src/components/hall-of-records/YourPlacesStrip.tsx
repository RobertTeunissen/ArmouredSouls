import type { MyPlacesSummary } from '../../utils/hallOfRecords';
import type { MyPlace } from './types';

export interface YourPlacesStripProps {
  stableName: string;
  summary: MyPlacesSummary;
  onlyMine: boolean;
  onToggleOnlyMine: () => void;
}

function placeText(place: MyPlace): string {
  const mode = place.variantLabel ? ` (${place.variantLabel})` : '';
  const subject = place.row.holder.subjectName ? ` · ${place.row.holder.subjectName}` : '';
  return `${place.recordTitle}${mode}${subject} · ${place.row.value}`;
}

/**
 * The viewer's stable on the board: how many records it holds, how many top-10
 * places, and a filter that shows only the records it appears in.
 */
export function YourPlacesStrip({ stableName, summary, onlyMine, onToggleOnlyMine }: YourPlacesStripProps) {
  const { held, placeCount, best } = summary;
  const headline = placeCount === 0
    ? 'No top-10 places yet this season'
    : `${held.length} ${held.length === 1 ? 'record' : 'records'} held · ${placeCount} top-10 ${placeCount === 1 ? 'place' : 'places'}`;

  return (
    <section
      aria-label="Your stable in the Hall of Records"
      className="flex flex-col gap-3 rounded-lg border border-white/10 border-l-4 border-l-primary bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between"
      data-testid="your-places"
    >
      <div className="min-w-0">
        <p className="font-semibold text-white">{stableName}</p>
        <p className="text-sm text-secondary">{headline}</p>
      </div>
      {placeCount > 0 && (
        <div className="min-w-0 text-sm md:flex-1 md:px-6">
          <p className="text-xs uppercase tracking-wide text-secondary">
            {held.length > 0 ? (held.length === 1 ? 'Your record' : 'Your records') : 'Your best place'}
          </p>
          {held.length > 0 ? (
            <ul>
              {held.slice(0, 3).map((place) => (
                <li key={`${place.recordKey}-${place.variantKey}`} className="text-white">🥇 {placeText(place)}</li>
              ))}
              {held.length > 3 && <li className="text-secondary">and {held.length - 3} more</li>}
            </ul>
          ) : (
            best && <p className="text-white">#{best.row.rank} {placeText(best)}</p>
          )}
        </div>
      )}
      {placeCount > 0 && (
        <button
          type="button"
          onClick={onToggleOnlyMine}
          aria-pressed={onlyMine}
          className={`min-h-[44px] shrink-0 rounded-lg px-4 text-sm font-medium transition-colors ${
            onlyMine ? 'bg-primary text-background' : 'border border-white/10 bg-surface-elevated text-primary hover:bg-surface'
          }`}
        >
          Show only my places
        </button>
      )}
    </section>
  );
}
