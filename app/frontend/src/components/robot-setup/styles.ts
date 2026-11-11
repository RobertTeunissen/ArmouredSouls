/**
 * Button and panel classes for the setup wizard, matching the Robot Workshop
 * it hands over to (StatusBar, section panels and notices there).
 */
export const PRIMARY_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-background transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50';

export const SECONDARY_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-surface-elevated px-4 text-sm text-secondary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

export const TEXT_LINK = 'inline-flex min-h-[44px] items-center text-sm text-primary hover:underline';

export const PANEL = 'rounded-lg border border-white/10 bg-surface p-4 sm:p-5';

export const ERROR_NOTICE = 'rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error';
