import React from 'react';
import { Terminal, ShieldCheck, X, Cpu, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface CanvasRuntimeAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktop: boolean;
}

export function CanvasRuntimeAuditModal({
  isOpen,
  onClose,
  isDesktop,
}: CanvasRuntimeAuditModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm select-auto">
      <div className="flex h-full max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-violet-500/30 bg-[#141320] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[.08] bg-[#181628] px-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded p-1.5 bg-violet-500/20 text-violet-300">
              <Terminal size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Runtime Architecture & Terminal Audit</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 leading-relaxed text-slate-300">
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/[.07] p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
              <CheckCircle2 size={16} />
              <span>Active Environment: {isDesktop ? 'Desktop Native Linux/Host Shell' : 'Web Sandbox (In-Browser POSIX Simulator)'}</span>
            </div>
            <p className="text-xs text-teal-200/90 leading-relaxed">
              {isDesktop
                ? 'Running inside Ayatrisya Desktop with direct authorized IPC bridge to the local host operating system shell.'
                : 'Running inside the web browser. The terminal is powered by a high-fidelity in-browser JavaScript POSIX shell and virtual in-memory filesystem with live canvas synchronization.'}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-violet-400" />
              Honest Architecture Classification
            </h4>
            <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3 space-y-2 text-slate-300">
              <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                <span className="text-slate-400">Environment Type:</span>
                <span className="font-mono font-medium text-white">{isDesktop ? 'Native Process Bridge' : 'In-Browser JavaScript POSIX Simulator'}</span>
              </div>
              <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                <span className="text-slate-400">Virtual Filesystem Mount:</span>
                <span className="font-mono text-violet-300">/home/ayatrisya/project</span>
              </div>
              <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                <span className="text-slate-400">Filesystem Synchronization:</span>
                <span className="text-teal-300 font-medium">✓ Real-time Bidirectional with Canvas Files</span>
              </div>
              <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                <span className="text-slate-400">Network Security Boundary:</span>
                <span className="text-slate-200">Zero Host Egress / Local In-Memory Sandbox</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Private Token Isolation:</span>
                <span className="text-teal-300 font-medium">Enforced (Auth tokens never exposed to terminal)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Cpu size={14} className="text-violet-400" />
              Supported Commands & Tools
            </h4>
            <p className="text-[11px] text-slate-400">
              The in-browser virtual environment supports the following POSIX commands:
            </p>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {['ls', 'cat', 'pwd', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'echo', 'grep', 'find', 'node', 'python3', 'git', 'npm', 'curl', 'uname', 'uptime', 'whoami', 'ps', 'top', 'env', 'export', 'clear', 'help', 'history', 'date'].map((cmd) => (
                <span key={cmd} className="rounded bg-white/[.06] px-2 py-0.5 text-violet-300 border border-white/[.04]">
                  {cmd}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-3 text-xs text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-300">
              <AlertTriangle size={14} />
              <span>Documented Web Mode Limitations</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              In client-only web mode without desktop companion, arbitrary binary execution (e.g. uncompiled C++ kernel modules or direct raw sockets) is safely simulated. Full arbitrary binary execution and Docker container hosting are available when pairing with Ayatrisya Desktop.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-12 shrink-0 items-center justify-end border-t border-white/[.08] bg-[#181628] px-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
