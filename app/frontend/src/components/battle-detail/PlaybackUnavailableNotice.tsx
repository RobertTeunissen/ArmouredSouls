/**
 * Displayed when a battle's replay data has been pruned (older than 7 days).
 * The overview statistics remain available permanently from the pre-computed summary.
 */
export function PlaybackUnavailableNotice() {
  return (
    <div className="bg-surface rounded-lg p-4 text-center">
      <div className="text-2xl mb-2">📼</div>
      <p className="text-secondary text-sm">
        Battle replay is available for 7 days after the battle.
        The overview and statistics above are preserved permanently.
      </p>
    </div>
  );
}
