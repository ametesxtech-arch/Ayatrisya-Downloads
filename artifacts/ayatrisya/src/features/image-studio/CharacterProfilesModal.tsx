import { useState } from 'react';
import { Plus, Trash2, Edit3, User, Check, AlertCircle, Info } from 'lucide-react';
import { Button, Modal, inputCls, areaCls } from '@/components/Primitives';
import type { CharacterProfile, CharacterConsistencyMode } from './types';
import { saveCharacterProfile, deleteCharacterProfile } from './character-profiles';

interface CharacterProfilesModalProps {
  profiles: CharacterProfile[];
  activeProfileId?: string;
  onSelectProfile: (profile: CharacterProfile | undefined) => void;
  onProfilesChanged: () => void;
  onClose: () => void;
}

export function CharacterProfilesModal({
  profiles,
  activeProfileId,
  onSelectProfile,
  onProfilesChanged,
  onClose,
}: CharacterProfilesModalProps) {
  const [editingProfile, setEditingProfile] = useState<Partial<CharacterProfile> | null>(null);
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [hairstyle, setHairstyle] = useState('');
  const [facialFeatures, setFacialFeatures] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [clothing, setClothing] = useState('');
  const [accessories, setAccessories] = useState('');
  const [personality, setPersonality] = useState('');
  const [consistencyMode, setConsistencyMode] = useState<CharacterConsistencyMode>(
    'consistent-face-allow-outfit-changes',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startCreate() {
    setEditingProfile({});
    setName('');
    setAppearance('');
    setHairstyle('');
    setFacialFeatures('');
    setSkinTone('');
    setClothing('');
    setAccessories('');
    setPersonality('');
    setConsistencyMode('consistent-face-allow-outfit-changes');
    setError('');
  }

  function startEdit(profile: CharacterProfile) {
    setEditingProfile(profile);
    setName(profile.name);
    setAppearance(profile.appearance);
    setHairstyle(profile.hairstyle);
    setFacialFeatures(profile.facialFeatures);
    setSkinTone(profile.skinTone);
    setClothing(profile.clothing);
    setAccessories(profile.accessories);
    setPersonality(profile.personality);
    setConsistencyMode(profile.consistencyMode || 'consistent-face-allow-outfit-changes');
    setError('');
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Please provide a character name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await saveCharacterProfile({
        id: editingProfile?.id,
        name,
        appearance,
        hairstyle,
        facialFeatures,
        skinTone,
        clothing,
        accessories,
        personality,
        consistencyMode,
      });
      onProfilesChanged();
      onSelectProfile(saved);
      setEditingProfile(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to save character profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (activeProfileId === id) {
      onSelectProfile(undefined);
    }
    await deleteCharacterProfile(id);
    onProfilesChanged();
  }

  return (
    <Modal
      title={editingProfile !== null ? (editingProfile.id ? 'Edit Character Profile' : 'New Character Profile') : 'Character Profiles'}
      onClose={onClose}
    >
      {editingProfile !== null ? (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-3 text-xs text-amber-200/90 flex gap-2.5">
            <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <p>
              Character profiles append structured physical and facial attributes to prompts across generations. Notice: Diffusion models produce strong visual affinity but cannot guarantee pixel-identical biometric identity.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Character Name *
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Captain Lyra Vance"
                className={`${inputCls} mt-1`}
                data-testid="input-character-name"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-300">
              General Appearance & Build
              <input
                type="text"
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder="e.g. Athletic build, early 30s, tall"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Hairstyle & Color
              <input
                type="text"
                value={hairstyle}
                onChange={(e) => setHairstyle(e.target.value)}
                placeholder="e.g. Shoulder-length wavy auburn hair"
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-300">
              Facial Features & Eyes
              <input
                type="text"
                value={facialFeatures}
                onChange={(e) => setFacialFeatures(e.target.value)}
                placeholder="e.g. Emerald green eyes, sharp jawline, light freckles"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Skin Tone & Complexion
              <input
                type="text"
                value={skinTone}
                onChange={(e) => setSkinTone(e.target.value)}
                placeholder="e.g. Warm olive complexion, sun-kissed"
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-300">
              Signature / Default Outfit
              <input
                type="text"
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
                placeholder="e.g. Dark charcoal high-collar trench coat"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Accessories
              <input
                type="text"
                value={accessories}
                onChange={(e) => setAccessories(e.target.value)}
                placeholder="e.g. Silver compass pendant, brass goggles"
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Personality, Demeanor & Posture
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Composed, observant, slight confident smirk"
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>

          <div className="space-y-2 pt-1 border-t border-white/[.07]">
            <span className="block text-xs font-medium text-slate-300">Consistency Mode</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition ${
                  consistencyMode === 'consistent-face-allow-outfit-changes'
                    ? 'border-violet-500 bg-violet-500/10 text-slate-100'
                    : 'border-white/10 bg-white/[.02] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="consistency"
                  checked={consistencyMode === 'consistent-face-allow-outfit-changes'}
                  onChange={() => setConsistencyMode('consistent-face-allow-outfit-changes')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-slate-200">Keep face & identity consistent</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Allows outfit changes in different scenes.</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition ${
                  consistencyMode === 'consistent-face-and-outfit'
                    ? 'border-violet-500 bg-violet-500/10 text-slate-100'
                    : 'border-white/10 bg-white/[.02] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="consistency"
                  checked={consistencyMode === 'consistent-face-and-outfit'}
                  onChange={() => setConsistencyMode('consistent-face-and-outfit')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-slate-200">Keep face & outfit consistent</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Always locks both face and signature outfit.</div>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[.07]">
            <Button variant="outline" onClick={() => setEditingProfile(null)} disabled={saving}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-character-profile-button">
              {saving ? 'Saving…' : 'Save Character'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Select an active character to append consistent visual details to all scene prompts.
            </p>
            <Button onClick={startCreate} data-testid="new-character-button">
              <Plus size={14} />
              New Character
            </Button>
          </div>

          {profiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
              <User size={28} className="mx-auto mb-2 text-slate-600" />
              No character profiles yet. Click &ldquo;New Character&rdquo; to define your first character.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {activeProfileId && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => onSelectProfile(undefined)}
                    className="text-xs text-slate-400 hover:text-violet-300 underline"
                  >
                    Clear active character (generate without character profile)
                  </button>
                </div>
              )}
              {profiles.map((profile) => {
                const isActive = activeProfileId === profile.id;
                return (
                  <div
                    key={profile.id}
                    className={`rounded-xl border p-3.5 transition flex items-start justify-between gap-3 ${
                      isActive
                        ? 'border-violet-500/40 bg-violet-500/[.08]'
                        : 'border-white/[.07] bg-[#15171e] hover:border-white/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200">{profile.name}</span>
                        {isActive && (
                          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                            Active
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {profile.consistencyMode === 'consistent-face-and-outfit'
                            ? 'Locked outfit'
                            : 'Flexible outfit'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {[profile.appearance, profile.hairstyle, profile.clothing]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant={isActive ? 'solid' : 'outline'}
                        onClick={() => onSelectProfile(isActive ? undefined : profile)}
                      >
                        {isActive ? <Check size={14} /> : 'Select'}
                      </Button>
                      <Button variant="outline" onClick={() => startEdit(profile)} title="Edit profile">
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDelete(profile.id)}
                        title="Delete profile"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-white/[.07]">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
