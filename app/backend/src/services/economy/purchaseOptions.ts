/**
 * Options shared by the extracted economy services (Spec #55 design §9.4, §10).
 */
import type { EconomicServiceOptions } from '../financial/economicRequestReplayService';

/**
 * Spending is not a security signal (rapid spending of a player's own credits
 * was removed in Nov 2026: it only flagged normal shopping), so the purchase
 * services take the replay options only.
 */
export type PurchaseServiceOptions = EconomicServiceOptions;
