/**
 * Input caps, shared so the browser can stop an oversized request before
 * sending it and the server refuses the same thing if the browser didn't.
 * They also bound what one request can cost.
 */
export const MIN_JOB_DESCRIPTION = 50
export const MAX_JOB_DESCRIPTION = 12_000
export const MAX_ASSISTANT_MESSAGE = 2_000
