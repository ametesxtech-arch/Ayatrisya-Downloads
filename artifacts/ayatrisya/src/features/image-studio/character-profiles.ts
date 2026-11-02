/**
 * Reusable Character Consistency System for Ayatrisya Image Studio
 *
 * Persists character profiles and generates structured prompt specifications
 * to preserve visual consistency across multiple scene generations.
 */

import type { CharacterProfile, CharacterConsistencyMode } from './types';
import { repository } from '@/storage/repository';

export const CHARACTER_PROFILES_STORAGE_KEY = 'ayatrisya:character-profiles:v1';
export const CHARACTER_TAG = 'character-profile';

/**
 * Loads all saved character profiles for the current workspace owner.
 * Pulls from local storage / repository notes with tag 'character-profile'.
 */
export async function loadCharacterProfiles(): Promise<CharacterProfile[]> {
  const profilesMap = new Map<string, CharacterProfile>();

  // 1. Try local storage cache
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CHARACTER_PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.id && item.name) {
              profilesMap.set(item.id, item);
            }
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 2. Query repository for persisted items
  try {
    const items = await repository.listItems({ kind: 'note', limit: 200 });
    const characterItems = items.filter((item) => item.tags.includes(CHARACTER_TAG));
    for (const item of characterItems) {
      try {
        const parsed = JSON.parse(item.content) as CharacterProfile;
        if (parsed && parsed.name) {
          profilesMap.set(parsed.id || item.id, {
            ...parsed,
            id: parsed.id || item.id,
            name: parsed.name || item.title,
            createdAt: parsed.createdAt || item.createdAt,
            updatedAt: parsed.updatedAt || item.updatedAt,
          });
        }
      } catch {
        // Skip unparseable items
      }
    }
  } catch {
    // Repository unavailable fallback
  }

  return Array.from(profilesMap.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Saves or updates a character profile.
 */
export async function saveCharacterProfile(
  input: Omit<CharacterProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<CharacterProfile> {
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const profile: CharacterProfile = {
    ...input,
    id,
    name: input.name.trim() || 'Untitled Character',
    appearance: input.appearance.trim(),
    hairstyle: input.hairstyle.trim(),
    facialFeatures: input.facialFeatures.trim(),
    skinTone: input.skinTone.trim(),
    clothing: input.clothing.trim(),
    accessories: input.accessories.trim(),
    personality: input.personality.trim(),
    consistencyMode: input.consistencyMode || 'consistent-face-allow-outfit-changes',
    createdAt: (input as any).createdAt || now,
    updatedAt: now,
  };

  // 1. Persist to repository as a note item
  try {
    await repository.saveItem({
      id: profile.id,
      title: profile.name,
      kind: 'note',
      content: JSON.stringify(profile),
      tags: [CHARACTER_TAG, 'image-studio'],
    });
  } catch {
    // If repository fails, still cache in localStorage
  }

  // 2. Update localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const existing = await loadCharacterProfiles();
      const updated = [profile, ...existing.filter((p) => p.id !== profile.id)];
      window.localStorage.setItem(CHARACTER_PROFILES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  return profile;
}

/**
 * Deletes a character profile by ID.
 */
export async function deleteCharacterProfile(id: string): Promise<void> {
  try {
    await repository.deleteItem(id);
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CHARACTER_PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item) => item.id !== id);
          window.localStorage.setItem(CHARACTER_PROFILES_STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}
  }
}

/**
 * Formats a character profile into a prompt segment, respecting the consistency mode.
 */
export function formatCharacterPromptSegment(
  character: CharacterProfile,
  sceneOverridesOutfit: boolean = false,
): string {
  const parts: string[] = [];

  parts.push(`featuring character "${character.name}"`);

  if (character.appearance) {
    parts.push(character.appearance);
  }
  if (character.facialFeatures) {
    parts.push(character.facialFeatures);
  }
  if (character.hairstyle) {
    parts.push(`hair: ${character.hairstyle}`);
  }
  if (character.skinTone) {
    parts.push(`complexion: ${character.skinTone}`);
  }

  // Handle outfit based on consistency mode
  const keepOutfit = character.consistencyMode === 'consistent-face-and-outfit';
  if (keepOutfit && character.clothing) {
    parts.push(`wearing ${character.clothing}`);
  } else if (!keepOutfit && !sceneOverridesOutfit && character.clothing) {
    parts.push(`default outfit: ${character.clothing}`);
  }

  if (character.accessories) {
    parts.push(`accessories: ${character.accessories}`);
  }
  if (character.personality) {
    parts.push(`expression and demeanor: ${character.personality}`);
  }

  return parts.join(', ');
}
