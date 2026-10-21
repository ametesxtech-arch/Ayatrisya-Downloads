const KEY = "ayatrisya.guest.image-generation-count.v1";
export const GUEST_IMAGE_LIMIT = 2;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function countFromStorage(storage: StorageLike): number {
  const raw = storage.getItem(KEY);
  const count = Number(raw ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? Math.min(count, GUEST_IMAGE_LIMIT) : GUEST_IMAGE_LIMIT;
}

export function getGuestImageGenerationCount(storage?: StorageLike): number {
  try {
    const target = storage ?? window.localStorage;
    return countFromStorage(target);
  } catch {
    return GUEST_IMAGE_LIMIT;
  }
}

export function reserveGuestImageGeneration(storage?: StorageLike): () => void {
  const target = storage ?? window.localStorage;
  const current = countFromStorage(target);
  if (current >= GUEST_IMAGE_LIMIT) throw new Error("Guest image allowance used. Create an account for the rest of Ayatrisya.");
  target.setItem(KEY, String(current + 1));
  return () => {
    try {
      const latest = countFromStorage(target);
      target.setItem(KEY, String(Math.max(0, latest - 1)));
    } catch {
      // Keep the reservation if the browser storage became unavailable.
    }
  };
}
