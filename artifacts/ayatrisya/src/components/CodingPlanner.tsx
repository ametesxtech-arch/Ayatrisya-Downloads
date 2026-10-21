import { useState } from "react";
import { ListTodo, Send, Sparkles } from "lucide-react";
import { Button, Modal, Notice, areaCls, inputCls } from "@/components/Primitives";
import { useCaps, usePrefs } from "@/hooks/use-prefs";
import { modelClient } from "@/ai/client";
import { formatCodingPlan, parseCodingPlan, type CodingPlan } from "@/ai/coding-plan";
import { repository } from "@/storage/repository";
import { errMsg } from "@/lib/format";

const plannerInstructions = [
  "You are Ayatrisya Planner, a practical software project planning agent.",
  "Use only the user's brief. Do not claim to inspect files, run code, create an app, deploy, or call tools.",
  "Plan projects such as websites, games, desktop apps, mobile apps, and APIs. Prefer incremental milestones, testable acceptance checks, privacy and security safeguards, and realistic dependencies.",
  "Do not recommend sending project content to third-party AI services. Never include secrets or credentials.",
  'Return only valid JSON with this exact shape: {"title":"...","goal":"...","architecture":"...","phases":[{"title":"...","tasks":["..."]}],"acceptanceChecks":["..."],"risks":["..."]}.',
].join("\n");

export function CodingPlanner({ notify }: { notify: (message: string) => void }) {
  const { prefs } = usePrefs();
  const { caps } = useCaps();
  const capability = caps.find((model) => model.id === prefs.model);
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState("Website");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<CodingPlan | null>(null);

  async function createPlan() {
    if (!capability?.available || !idea.trim()) return;
    setConfirmOpen(false);
    setBusy(true);
    setError("");
    setPlan(null);
    try {
      const job = modelClient.submitJob({
        kind: "chat",
        messages: [{
          role: "user",
          content: `${plannerInstructions}\n\nProject type: ${kind}\n\nUser brief:\n${idea.trim()}`,
        }],
        options: { model: prefs.model, mode: prefs.mode },
      });
      const raw = await job.result;
      setPlan(parseCodingPlan(raw));
    } catch (cause) {
      setError(errMsg(cause, "The Ayatrisya planner could not create a plan."));
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      await repository.saveItem({
        title: plan.title,
        kind: "code",
        content: formatCodingPlan(plan),
        tags: ["coding", "ai-plan", kind.toLowerCase().replaceAll(" ", "-")],
      });
      notify("Plan saved to Coding workspace and Library.");
      setPlan(null);
      setIdea("");
    } catch (cause) {
      setError(errMsg(cause, "The plan could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="mb-5 rounded-xl border border-violet-300/15 bg-violet-300/[.025] p-4 sm:p-5" aria-labelledby="coding-planner-title">
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-300/10 text-violet-200"><ListTodo size={17} /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-200/80">Ayatrisya Planner</p>
        <h2 id="coding-planner-title" className="display mt-1 text-base font-semibold">Turn an idea into a build plan</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">Creates phased tasks, acceptance checks, architecture notes, and risks. It does not edit files or run commands.</p>
      </div>
      <span className={`ml-auto hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] sm:inline-flex ${capability?.available ? "border-teal-300/20 text-teal-200" : "border-white/10 text-slate-500"}`} role="status">
        {capability?.available ? "Ayatrisya model ready" : "Model unavailable"}
      </span>
    </div>
    <Notice>Only the project type and brief below are sent to your configured Ayatrisya model server after you approve. No project files are included, and no third-party model API is used by this feature.</Notice>
    <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
      <label className="block text-xs font-medium text-slate-400">Project type
        <select value={kind} onChange={(event) => setKind(event.target.value)} className={`${inputCls} mt-1.5`} data-testid="select-plan-type">
          {["Website", "Game", "Desktop app", "Mobile app", "API or service", "Other"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-400">What do you want to build?
        <textarea value={idea} maxLength={4000} onChange={(event) => setIdea(event.target.value)} placeholder="Describe users, the main outcome, and any constraints. Do not include credentials or private data." className={`${areaCls} mt-1.5 min-h-24 resize-y text-xs`} data-testid="input-plan-brief" />
      </label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[10px] text-slate-500">{idea.length}/4,000 characters · {capability?.label ?? prefs.model}</p>
      <Button onClick={() => setConfirmOpen(true)} disabled={busy || !idea.trim() || !capability?.available} data-testid="button-create-plan"><Sparkles size={14} />{busy ? "Planning…" : "Plan this project"}</Button>
    </div>
    {error && <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200" role="alert" data-testid="status-planner-error">{error}</p>}
    {plan && <div className="mt-4 rounded-lg border border-white/[.08] bg-black/10 p-4" data-testid="result-coding-plan">
      <h3 className="text-sm font-semibold">{plan.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{plan.goal}</p>
      <p className="mt-3 text-xs leading-5 text-slate-400"><b className="text-slate-300">Architecture:</b> {plan.architecture}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {plan.phases.map((phase, index) => <section key={`${phase.title}-${index}`} className="rounded-lg border border-white/[.06] p-3">
          <h4 className="text-xs font-semibold">{index + 1}. {phase.title}</h4>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-slate-400">{phase.tasks.map((task, taskIndex) => <li key={`${task}-${taskIndex}`}>• {task}</li>)}</ul>
        </section>)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><h4 className="text-xs font-semibold">Acceptance checks</h4><ul className="mt-2 space-y-1 text-[11px] leading-5 text-slate-400">{plan.acceptanceChecks.map((check, index) => <li key={`${check}-${index}`}>• {check}</li>)}</ul></div>
        <div><h4 className="text-xs font-semibold">Risks and safeguards</h4><ul className="mt-2 space-y-1 text-[11px] leading-5 text-slate-400">{(plan.risks.length ? plan.risks : ["No major risks identified."]).map((risk, index) => <li key={`${risk}-${index}`}>• {risk}</li>)}</ul></div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setPlan(null)} disabled={busy}>Discard plan</Button><Button onClick={() => void savePlan()} disabled={busy} data-testid="button-save-plan"><Send size={13} />Save to Coding workspace</Button></div>
    </div>}
    {confirmOpen && <Modal title="Send this brief to the Ayatrisya planner?" onClose={() => setConfirmOpen(false)}>
      <p className="text-sm leading-6 text-slate-400">Ayatrisya sends the selected project type and your brief to the configured model endpoint. This feature does not use another company’s AI API. The planner returns a plan only; it will not change files or execute commands.</p>
      <div className="mt-3 max-h-36 overflow-auto rounded-lg border border-white/[.07] bg-black/10 p-3 text-xs leading-5 text-slate-300"><b>{kind}</b><p className="mt-1 whitespace-pre-wrap">{idea.trim()}</p></div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button onClick={() => void createPlan()}><Send size={13} />Send and plan</Button></div>
    </Modal>}
  </section>;
}
