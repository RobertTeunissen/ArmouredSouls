import React from 'react';
import { PlaybackState, PlaybackSpeed } from './types';

interface PlaybackControlsProps {
  state: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onTogglePlayPause: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onSeekTo: (time: number) => void;
  onSkipToNextEvent: () => void;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4];

/** Format seconds as MM:SS.s */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
}

/**
 * Playback controls: play/pause, speed selector, skip, and timeline scrubber.
 *
 * Validates: Requirement 17.7
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  state,
  onTogglePlayPause,
  onSetSpeed,
  onSeekTo,
  onSkipToNextEvent,
}) => {
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onSeekTo(parseFloat(e.target.value));
  };

  const progressPercent = state.duration > 0
    ? (state.currentTime / state.duration) * 100
    : 0;

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-lg">
      {/* Timeline scrubber */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono w-16 text-right">
          {formatTime(state.currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={state.duration}
          step={0.1}
          value={state.currentTime}
          onChange={handleScrub}
          className="flex-1 h-2 accent-blue-500 cursor-pointer"
          aria-label="Battle timeline scrubber"
          style={{
            background: `linear-gradient(to right, #3B82F6 ${progressPercent}%, #374151 ${progressPercent}%)`,
          }}
        />
        <span className="text-xs text-gray-400 font-mono w-16">
          {formatTime(state.duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlayPause}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            aria-label={state.isPlaying ? 'Pause playback' : 'Play playback'}
          >
            {state.isPlaying ? '⏸' : '▶'}
          </button>

          {/* Skip to next event */}
          <button
            onClick={onSkipToNextEvent}
            className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            aria-label="Skip to next event"
          >
            ⏭
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">Speed:</span>
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                state.speed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              aria-label={`Set playback speed to ${speed}x`}
              aria-pressed={state.speed === speed}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
