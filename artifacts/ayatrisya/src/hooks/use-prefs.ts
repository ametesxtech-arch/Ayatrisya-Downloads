import { useCallback } from 'react';
import { pushNotice } from '@/lib/notify';
import { useLocalQuery } from '@/storage/hooks';
import { repository } from '@/storage/repository';
import { defaultPreferences, type Preferences } from '@/storage/types';
import { modelClient } from '@/ai/client';

export function usePrefs() {
  const q = useLocalQuery(() => repository.getPreferences(), []);
  const prefs: Preferences = { ...defaultPreferences, ...(q.data ?? {}) };
  const save = useCallback(async (patch: Partial<Preferences>) => {
    try { return await repository.savePreferences(patch); } catch {
      pushNotice('Preferences could not be saved in this browser. Check storage availability and try again.');
      return undefined;
    }
  }, []);
  return { prefs, loaded: q.data !== undefined, save };
}

export function useCaps() {
  const q = useLocalQuery(() => modelClient.getModelCapabilities(), []);
  return { caps: q.data ?? [], loading: q.loading, error: q.error, refresh: q.refresh };
}
