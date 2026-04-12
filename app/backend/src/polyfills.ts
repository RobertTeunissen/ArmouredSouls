/**
 * Polyfills for Node.js 22+ compatibility.
 *
 * util.isNullOrUndefined was removed in Node 22 but is still used by
 * @tensorflow/tfjs-node v4.x in its compiled dist files.
 *
 * This file MUST be imported before any @tensorflow/tfjs-node import
 * (including transitive imports via nsfwjs or contentModerationService).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const util = require('util');

if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (value: unknown): value is null | undefined =>
    value === null || value === undefined;
}
