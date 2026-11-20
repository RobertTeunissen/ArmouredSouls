/**
 * Options shared by the extracted economy services (Spec #55 design §9.4, §10).
 */
import type { EconomicServiceOptions } from '../financial/economicRequestReplayService';

/** Purchase services take the replay options only; spending is not a security signal. */
export type PurchaseServiceOptions = EconomicServiceOptions;
