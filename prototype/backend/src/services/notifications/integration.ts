export interface NotificationResult {
  success: boolean;
  integrationName: string;
  error?: string;
}

export interface Integration {
  readonly name: string;
  send(message: string): Promise<NotificationResult>;
}

export type JobName = 'league' | 'tournament' | 'tag-team' | 'settlement';

export interface JobContext {
  jobName: JobName;
  tournamentName?: string;
  tournamentRound?: number;
  tournamentMaxRounds?: number;
  isEvenCycle?: boolean;
}
