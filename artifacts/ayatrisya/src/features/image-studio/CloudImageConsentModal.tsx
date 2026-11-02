import { Shield, Sparkles } from 'lucide-react';
import { Button, Modal } from '@/components/Primitives';
import { grantCloudImageConsent } from './consent';

interface CloudImageConsentModalProps {
  onConsentGranted: () => void;
  onCancel: () => void;
}

export function CloudImageConsentModal({ onConsentGranted, onCancel }: CloudImageConsentModalProps) {
  function handleChoice(scope: 'session' | 'device') {
    grantCloudImageConsent(scope);
    onConsentGranted();
  }

  return (
    <Modal title="Cloud image generation permission" onClose={onCancel}>
      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[.06] p-3 text-slate-200">
          <Shield size={20} className="shrink-0 text-violet-400 mt-0.5" />
          <p>
            Generating images requires connecting to Ayatrisya’s configured cloud image provider. Your prompt, desired dimensions, and format will be sent securely to render the image.
          </p>
        </div>

        <p className="text-slate-400">
          No private notes, code files, or other workspace documents are ever shared. You can choose whether to grant permission for this session or remember your choice on this device. You can revoke this permission anytime from <b>Settings → Privacy</b>.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} data-testid="consent-button-not-now">
            Not now
          </Button>
          <Button
            variant="outline"
            onClick={() => handleChoice('session')}
            data-testid="consent-button-session"
          >
            Allow for this session
          </Button>
          <Button
            onClick={() => handleChoice('device')}
            data-testid="consent-button-device"
          >
            <Sparkles size={14} />
            Always allow on this device
          </Button>
        </div>
      </div>
    </Modal>
  );
}
