/**
 * Options shared by the extracted economy services (Spec #55 design §9.4, §10).
 */
import type { EconomicServiceOptions } from '../financial/economicRequestReplayService';

/** Request context for spending monitoring; only HTTP callers supply it. */
export interface SpendingMonitorContext {
  sourceIp?: string;
  endpoint?: string;
}

export interface PurchaseServiceOptions extends EconomicServiceOptions {
  /**
   * When present, the spend is reported to `securityMonitor.trackSpending`
   * exactly as the player route did before the extraction. Automaton turns
   * omit it: there is no client request to monitor.
   */
  spendingMonitor?: SpendingMonitorContext;
}
