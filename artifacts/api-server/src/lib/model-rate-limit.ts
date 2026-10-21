const WINDOW_MS = 60_000;
const REQUESTS_PER_MINUTE = 60;
const GENERATIONS_PER_MINUTE = 10;
const MAX_TRACKED_USERS = 10_000;

type UserWindow = { startedAt: number; requests: number; generations: number };
const windows = new Map<string, UserWindow>();

export function consumeModelRequest(
  uid: string,
  isGeneration: boolean,
  now = Date.now(),
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  let bucket = windows.get(uid);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    bucket = { startedAt: now, requests: 0, generations: 0 };
    windows.set(uid, bucket);
  }

  if (bucket.requests >= REQUESTS_PER_MINUTE ||
      (isGeneration && bucket.generations >= GENERATIONS_PER_MINUTE)) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + WINDOW_MS - now) / 1000)),
    };
  }

  bucket.requests += 1;
  if (isGeneration) bucket.generations += 1;

  if (windows.size > MAX_TRACKED_USERS) {
    for (const [userId, value] of windows) {
      if (now - value.startedAt >= WINDOW_MS) windows.delete(userId);
    }
    while (windows.size > MAX_TRACKED_USERS) {
      const oldest = windows.keys().next().value as string | undefined;
      if (!oldest) break;
      windows.delete(oldest);
    }
  }
  return { allowed: true };
}
