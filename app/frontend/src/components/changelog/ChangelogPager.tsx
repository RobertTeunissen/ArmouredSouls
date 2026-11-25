interface ChangelogPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const BUTTON_CLASSES =
  'px-3 py-2 rounded bg-surface border border-white/10 text-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed';

/** Previous / "Page x of y" / Next; renders nothing for a single page. */
function ChangelogPager({ page, totalPages, onPageChange }: ChangelogPagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center gap-2 mt-6">
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={BUTTON_CLASSES}>
        Previous
      </button>
      <span className="px-3 py-2 text-secondary">Page {page} of {totalPages}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={BUTTON_CLASSES}>
        Next
      </button>
    </div>
  );
}

export default ChangelogPager;
