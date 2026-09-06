/**
 * Compatibility hook for integration suites. Financial capture is always
 * enabled by the deployed writer, so no database fixture is required.
 */
export async function prepareFinancialCaptureTestEnvironment(): Promise<void> {
  // Intentionally empty: capture is unconditional.
}

/** Register the legacy suite hook without mutating cycle metadata. */
export function useFinancialCaptureTestEnvironment(): void {
  // Intentionally empty: capture is unconditional.
}
