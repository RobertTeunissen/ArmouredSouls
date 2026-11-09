/** A robot that can join a team: from the stable overview, with its subscriptions. */
export interface TeamCandidateRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: string }[];
}
