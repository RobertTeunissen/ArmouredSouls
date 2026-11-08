import { useCallback, useMemo } from 'react';
import { RecordBoard, RecordDetail, RECORD_GROUPS } from '../hall-of-records';
import type { RecordDefinition } from '../hall-of-records';
import { findMyPlaces } from '../../utils/hallOfRecords';
import { archiveRecordCatalogue, isOwnArchivedRecord } from '../../utils/seasonArchiveRecords';
import type { SeasonDetail } from '../../utils/seasonApi';

export interface SeasonArchiveRecordsProps {
  detail: SeasonDetail;
  /** The viewer's stable name as archived rows carry it. */
  myName: string | null;
  viewerId: number | null;
  mineOnly: boolean;
  /** `?record=` / `?mode=` of the open record list, if any. */
  recordKey: string | null;
  modeKey: string | null;
}

/**
 * A completed season's records, in the Hall of Records tiles and top-10 list
 * (PRD_HALL_OF_RECORDS "Season Archive"). The open record lives in the URL
 * next to the season: `/seasons?season=2&record=mostKills`.
 */
export function SeasonArchiveRecords({ detail, myName, viewerId, mineOnly, recordKey, modeKey }: SeasonArchiveRecordsProps) {
  // "Show only my stable" keeps only the viewer's own rows, as it does for the
  // standings above: the board then shows the viewer's results (champion wins
  // included) at their stored ranks, not other stables' holders.
  const catalogue = useMemo(() => {
    const viewer = { stableName: myName, userId: viewerId };
    const accolades = mineOnly ? detail.accolades.filter((row) => isOwnArchivedRecord(row, viewer)) : detail.accolades;
    return archiveRecordCatalogue(accolades, viewer);
  }, [detail.accolades, myName, viewerId, mineOnly]);
  const places = useMemo(() => findMyPlaces(catalogue, viewerId), [catalogue, viewerId]);

  const seasonHref = `/seasons?season=${detail.seasonNumber}`;
  const detailHref = useCallback((record: RecordDefinition, variantKey?: string): string => {
    const params = new URLSearchParams({ season: String(detail.seasonNumber), record: record.key });
    if (variantKey) params.set('mode', variantKey);
    return `/seasons?${params.toString()}`;
  }, [detail.seasonNumber]);

  if (catalogue.length === 0) return null;
  const open = recordKey ? catalogue.find((record) => record.key === recordKey) : undefined;

  return (
    <section aria-labelledby={`season-${detail.seasonNumber}-records`} data-testid="season-archive-records">
      <h2 id={`season-${detail.seasonNumber}-records`} className="mb-3 text-xl font-medium text-white">Records</h2>
      {open ? (
        <RecordDetail
          record={open}
          siblings={catalogue.filter((record) => record.group === open.group)}
          variantKey={modeKey}
          viewerId={viewerId}
          backHref={seasonHref}
          detailHref={detailHref}
          notInListNote={null}
          headingLevel={3}
        />
      ) : (
        <RecordBoard
          records={catalogue}
          groups={RECORD_GROUPS}
          viewerId={viewerId}
          places={places}
          detailHref={detailHref}
          collapseOnMobile={!mineOnly}
          headingLevel={3}
          showNotes={false}
        />
      )}
    </section>
  );
}
