// Cloud Functions entry point — re-exports all handlers so the Functions runtime
// can discover them. Each handler is defined in its own file to keep unit test
// boundaries clean and to allow independent IAM/timeout/memory configuration.
export { processEntryEvent } from './handlers/processEntryEvent.js';
export { processPosEvent } from './handlers/processPosEvent.js';
export { processSensorEvent } from './handlers/processSensorEvent.js';
export { evaluateZoneThresholds } from './handlers/evaluateZoneThresholds.js';
export { dispatchFcmNotification } from './handlers/dispatchFcmNotification.js';
export { aggregateSessionMetrics } from './handlers/aggregateSessionMetrics.js';
