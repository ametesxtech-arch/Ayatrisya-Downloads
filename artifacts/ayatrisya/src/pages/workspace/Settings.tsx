import { useState, type ReactNode } from 'react';
import { Button, Eyebrow, Notice, Panel } from '@/components/Primitives';
import { cx } from '@/lib/cx';
import { PageHeading } from '@/components/PageHeading';

export function SettingsPage({
  theme,
  setTheme,
  notify,
}: {
  theme: string;
  setTheme: (s: string) => void;
  notify: (m: string) => void;
}) {
  const [category, setCategory] = useState('General'),
    [aiPreference, setAiPreference] = useState('Balanced'),
    [toggles, setToggles] = useState<Record<string, boolean>>({
      'Show welcome suggestions': true,
      'Reduce motion': false,
    });
  const cats = ['General', 'AI', 'Privacy', 'Storage', 'Desktop', 'About'];
  const toggle = (key: string) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Workspace preferences"
        title="Settings"
        description="Some preferences work for this session. Integrations and model behavior remain future features."
      />
      <div className="grid gap-5 md:grid-cols-[190px_1fr]">
        <nav
          aria-label="Settings categories"
          className="flex gap-1 overflow-x-auto md:flex-col"
        >
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cx(
                'min-h-9 shrink-0 rounded-lg px-3 text-left text-xs',
                category === c
                  ? 'bg-violet-300/[.09] text-violet-100'
                  : 'text-slate-500 hover:bg-white/[.04] hover:text-white',
              )}
            >
              {c}
            </button>
          ))}
        </nav>
        <Panel className="min-h-[500px] p-5 sm:p-7">
          <Eyebrow>{category} preferences</Eyebrow>
          {category === 'General' && (
            <>
              <h2 className="display text-xl font-semibold">
                Make the workspace comfortable.
              </h2>
              <SettingRow
                title="Theme"
                desc="Applied to this open session only."
              >
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-[#101116] px-3 text-xs"
                >
                  <option>Dark</option>
                  <option>Light</option>
                  <option>Follow system</option>
                </select>
              </SettingRow>
              <SettingRow
                title="Language"
                desc="Language preferences will be available later."
              >
                <button
                  onClick={() =>
                    notify('Language selection is not available yet.')
                  }
                  className="text-xs text-slate-500"
                >
                  English · default
                </button>
              </SettingRow>
              <SettingRow
                title="Show welcome suggestions"
                desc="Controls suggestion tiles in the welcome view."
              >
                <Toggle
                  checked={toggles['Show welcome suggestions']}
                  onClick={() => toggle('Show welcome suggestions')}
                />
              </SettingRow>
              <SettingRow
                title="Startup preference"
                desc="Choose where Ayatrisya opens in a future build."
              >
                <button
                  onClick={() =>
                    notify('Startup preferences are a future feature.')
                  }
                  className="text-xs text-slate-500"
                >
                  Last workspace · preview
                </button>
              </SettingRow>
            </>
          )}
          {category === 'AI' && (
            <>
              <h2 className="display text-xl font-semibold">
                Model preferences
              </h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                All model labels are placeholders. No inference service is
                connected.
              </p>
              <SettingRow
                title="Preferred model"
                desc="Seed is an experimental UI label; Core and Auto are planned."
              >
                <select
                  className="h-9 rounded-lg border border-white/10 bg-[#101116] px-3 text-xs"
                  onChange={() =>
                    notify(
                      'Model selection changes labels only; no model is connected.',
                    )
                  }
                >
                  <option>Seed · experimental</option>
                  <option>Core · planned</option>
                  <option>Auto · planned routing</option>
                </select>
              </SettingRow>
              <SettingRow
                title="Response preference"
                desc="Local preference for the future model interface."
              >
                <select
                  value={aiPreference}
                  onChange={(e) => setAiPreference(e.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-[#101116] px-3 text-xs"
                >
                  {['Balanced', 'Concise', 'Detailed'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow
                title="Creativity"
                desc="Model behavior control is not implemented."
              >
                <button
                  onClick={() =>
                    notify(
                      'Creativity controls will be available when Ayatrisya models are ready.',
                    )
                  }
                  className="text-xs text-slate-500"
                >
                  Default · not active
                </button>
              </SettingRow>
              <SettingRow
                title="Experimental features"
                desc="Feature flags are not connected."
              >
                <Toggle
                  checked={false}
                  onClick={() =>
                    notify('Experimental model features are not available.')
                  }
                />
              </SettingRow>
            </>
          )}
          {category === 'Privacy' && (
            <>
              <h2 className="display text-xl font-semibold">
                Privacy and control
              </h2>
              <div className="mt-4">
                <Notice>
                  Local-first storage is planned. This preview keeps demo
                  content in memory only and sends no AI requests.
                </Notice>
              </div>
              <SettingRow
                title="Memory summary"
                desc="No memory has been created in this preview."
              >
                <button
                  onClick={() =>
                    notify('There is no memory data to review or clear.')
                  }
                  className="text-xs text-slate-500"
                >
                  Review preview
                </button>
              </SettingRow>
              <SettingRow
                title="Export or delete data"
                desc="No account data is stored by this UI."
              >
                <button
                  onClick={() =>
                    notify('No stored data exists to export or delete.')
                  }
                  className="text-xs text-slate-500"
                >
                  View controls
                </button>
              </SettingRow>
              <SettingRow
                title="AI data transmission"
                desc="No AI service is connected. Future disclosure will explain data handling."
              >
                <span className="text-[10px] text-teal-200/70">
                  No requests made
                </span>
              </SettingRow>
            </>
          )}
          {category === 'Storage' && (
            <>
              <h2 className="display text-xl font-semibold">
                Storage overview
              </h2>
              <SettingRow
                title="Local storage"
                desc="Persistent local storage is not implemented."
              >
                <span className="text-[10px] text-slate-600">Preview only</span>
              </SettingRow>
              <SettingRow
                title="Desktop folders"
                desc="Folder access requires the desktop application."
              >
                <button
                  onClick={() =>
                    notify(
                      'Desktop folder access is unavailable in the web preview.',
                    )
                  }
                  className="text-xs text-slate-500"
                >
                  Learn more
                </button>
              </SettingRow>
              <SettingRow
                title="Google Drive"
                desc="Optional integration planned for later."
              >
                <Button
                  variant="outline"
                  onClick={() =>
                    notify('Drive is not connected. OAuth is not implemented.')
                  }
                >
                  Not connected
                </Button>
              </SettingRow>
              <SettingRow
                title="Sync preferences"
                desc="No sync service exists in this preview."
              >
                <Toggle
                  checked={false}
                  onClick={() => notify('Sync preferences are not available.')}
                />
              </SettingRow>
            </>
          )}
          {category === 'Desktop' && (
            <>
              <h2 className="display text-xl font-semibold">
                Ayatrisya Desktop
              </h2>
              <div className="mt-4">
                <Notice>
                  Desktop project access, shell approval and local editing are
                  not connected in this browser.
                </Notice>
              </div>
              <SettingRow
                title="Download status"
                desc="No installer has been published."
              >
                <Button
                  variant="outline"
                  onClick={() =>
                    notify('No desktop download is available yet.')
                  }
                >
                  Coming later
                </Button>
              </SettingRow>
              <SettingRow
                title="Startup behavior"
                desc="Settings are a preview."
              >
                <button
                  onClick={() =>
                    notify('Desktop startup behavior is not implemented.')
                  }
                  className="text-xs text-slate-500"
                >
                  Preview options
                </button>
              </SettingRow>
            </>
          )}
          {category === 'About' && (
            <>
              <h2 className="display text-xl font-semibold">About Ayatrisya</h2>
              <SettingRow
                title="Product"
                desc="Ametesx professional AI workspace."
              >
                <span className="text-xs text-slate-400">Ayatrisya</span>
              </SettingRow>
              <SettingRow title="Version" desc="Development preview.">
                <span className="mono text-[10px] text-slate-500">
                  0.1.0 · UI preview
                </span>
              </SettingRow>
              <SettingRow title="Built by" desc="Product by Ametesx.">
                <span className="text-xs text-slate-400">Ametesx</span>
              </SettingRow>
              <SettingRow
                title="Open source"
                desc="Included dependency licenses can be listed here before release."
              >
                <button
                  onClick={() =>
                    notify(
                      'License information will be provided before public release.',
                    )
                  }
                  className="text-xs text-violet-200"
                >
                  View licenses
                </button>
              </SettingRow>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[.06] py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs font-semibold text-slate-300">{title}</div>
        <div className="mt-1 max-w-md text-[10px] leading-5 text-slate-600">
          {desc}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={cx(
        'relative h-6 w-11 rounded-full border transition',
        checked
          ? 'border-violet-300/30 bg-violet-400/50'
          : 'border-white/10 bg-white/[.05]',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] size-4 rounded-full bg-slate-100 transition-transform',
          checked ? 'translate-x-[21px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}
