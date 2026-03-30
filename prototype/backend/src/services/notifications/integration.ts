export interface NotificationResult {
  success: boolean;
  integrationName: string;
  error?: string;
}

export interface Integration {
  readonly name: string;
  send(message: string): Promise<NotificationResult>;
}

export type JobName = 'league' | 'tournament' | 'tag-team' | 'settlement' | 'koth';

export interface JobContext {
  jobName: JobName;
  tournamentName?: string;
  tournamentRound?: number;
  tournamentMaxRounds?: number;
  tournamentScheduled?: boolean;
  isEvenCycle?: boolean;
  matchesCompleted?: number;
}
