import { ArrowRight, Download, Sun } from 'lucide-react';
import { Button, Panel } from '@/components/Primitives';
import { PageHeading } from '@/components/PageHeading';

export function AccountPage({ notify }: { notify: (m: string) => void }) {
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-8">
      <PageHeading
        eyebrow="Profile · illustrative usage"
        title="Account"
        description="Guest profile and usage summaries are sample UI. There is no authenticated account, billing or subscription."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              notify(
                'Account export is not available: no account data is stored.',
              )
            }
          >
            <Download size={14} />
            Export account data
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <Panel className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-[#22242c] text-sm font-semibold text-slate-300">
                AM
              </div>
              <div>
                <h2 className="font-semibold">Guest workspace</h2>
                <p className="mt-1 text-xs text-slate-500">
                  No account connected
                </p>
              </div>
              <Button
                variant="outline"
                className="ml-auto"
                onClick={() =>
                  notify(
                    'Profile editing requires an account, which is not connected.',
                  )
                }
              >
                Edit profile
              </Button>
            </div>
            <div className="mt-6 grid gap-3 border-t border-white/[.06] pt-5 sm:grid-cols-2">
              <div>
                <div className="text-[10px] text-slate-600">Email</div>
                <div className="mt-1 text-xs text-slate-400">Not provided</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600">Account type</div>
                <div className="mt-1 text-xs text-slate-400">
                  Guest · UI preview
                </div>
              </div>
            </div>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <h2 className="font-semibold">Sessions</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              Illustrative session list · no real sessions tracked
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/[.06] p-3">
              <span className="grid size-8 place-items-center rounded-lg bg-teal-300/[.06] text-teal-200">
                <Sun size={15} />
              </span>
              <span className="flex-1 text-xs text-slate-300">
                This browser session
                <span className="mt-1 block text-[9px] text-slate-600">
                  Current · sample
                </span>
              </span>
              <span className="rounded-full bg-teal-300/[.06] px-2 py-1 text-[9px] text-teal-200">
                Current
              </span>
            </div>
            <button
              onClick={() => notify('No other sessions exist in this preview.')}
              className="mt-3 text-[10px] text-slate-500 hover:text-white"
            >
              Review other sessions
            </button>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <h2 className="font-semibold">Usage overview</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              All values are illustrative, not measured.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Requests" value="—" />
              <Metric label="Model time" value="—" />
              <Metric label="Images created" value="0" />
              <Metric label="Documents" value="3 sample" />
            </div>
            <button
              onClick={() => notify('No real model usage is tracked.')}
              className="mt-4 text-[10px] text-violet-200"
            >
              Usage details
            </button>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel className="p-5">
            <h2 className="font-semibold">Storage summary</h2>
            <div className="mt-4 flex items-end justify-between">
              <span className="display text-2xl font-semibold">1.8 GB</span>
              <span className="text-[10px] text-slate-600">
                example of 10 GB
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/[.07]">
              <div className="h-full w-[18%] rounded-full bg-violet-300/60" />
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-600">
              Illustrative placeholder only. No storage is allocated or
              measured.
            </p>
            <button
              onClick={() =>
                notify(
                  'Storage management will be available when local storage ships.',
                )
              }
              className="mt-4 text-[10px] text-violet-200"
            >
              Storage details
            </button>
          </Panel>
          <Panel className="p-5">
            <h2 className="font-semibold">Plans & payments</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Subscriptions and payment features are intentionally not part of
              this development phase.
            </p>
          </Panel>
          <Panel className="p-5">
            <h2 className="font-semibold">Privacy controls</h2>
            <button
              onClick={() =>
                notify('There is no account data to delete in this preview.')
              }
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/[.07] px-3 py-2.5 text-xs text-slate-400 hover:text-white"
            >
              Delete account data <ArrowRight size={13} />
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[.06] bg-white/[.015] p-4">
      <div className="display text-xl font-semibold text-slate-200">
        {value}
      </div>
      <div className="mt-1 text-[9px] text-slate-600">{label}</div>
    </div>
  );
}
