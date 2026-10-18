/**
 * @file GeneratedTokenExportPanel.tsx
 * @description Single-use token generation, CSV download blob trigger, and mandatory export acknowledgment lock.
 * @architecture Token export workspace card in ClaimPortalWorkspace managing CSPRNG token distribution safety locks.
 * @agent_note Generates client-side CSV downloads containing unhashed tokens and enforces mandatory user acknowledgment before enabling activation.
 */

import { useState } from "react";
import { Download, Lock, CheckCircle, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import { escapeCsvCell } from "@/lib/csv-escape";

export interface GeneratedTokenExportPanelProps {
  portalId: string;
  revision: number;
  status: "preparing" | "awaiting_export_ack" | "ready" | "revoked" | "expired";
  onGenerate: () => Promise<Array<{ recipientKey: string; name: string; email: string; token: string }>>;
  onAcknowledge: (revision: number) => Promise<void>;
  onRotatePrompt?: () => void;
  disabled?: boolean;
}

/**
 * @component GeneratedTokenExportPanel
 * @description Workflow panel triggering CSPRNG token generation, client-side CSV export, and mandatory acknowledgment confirmation.
 * @param {GeneratedTokenExportPanelProps} props - Component properties.
 * @param {string} props.portalId - Claim portal identifier.
 * @param {number} props.revision - Active credential set revision number.
 * @param {"preparing" | "awaiting_export_ack" | "ready" | "revoked" | "expired"} props.status - Current credential set lifecycle status.
 * @param {Function} props.onGenerate - Async function returning recipient keys and raw tokens for CSV generation.
 * @param {(revision: number) => Promise<void>} props.onAcknowledge - Handler acknowledging CSV download to unlock portal.
 * @param {() => void} [props.onRotatePrompt] - Callback opening token rotation confirmation dialog.
 * @param {boolean} [props.disabled=false] - Whether actions are disabled.
 * @state {boolean} isGenerating - Spinner state during token creation.
 * @state {boolean} isAcknowledging - Spinner state during export acknowledgment submission.
 * @state {boolean} confirmedDownloaded - Whether CSV was triggered to unlock acknowledgment button.
 * @state {string | null} downloadBlobUrl - Object URL of generated CSV blob.
 * @returns {JSX.Element} Token generation and export card with security locks.
 */
export function GeneratedTokenExportPanel({
  revision,
  status,
  onGenerate,
  onAcknowledge,
  onRotatePrompt,
  disabled = false,
}: GeneratedTokenExportPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [confirmedDownloaded, setConfirmedDownloaded] = useState(false);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const tokens = await onGenerate();
      if (!tokens || tokens.length === 0) {
        toast.warning("No tokens generated");
        return;
      }

      // Build CSV client-side
      const headers = "RecipientKey,Name,Email,ClaimToken\n";
      const rows = tokens
        .map(
          (t) =>
            `${escapeCsvCell(t.recipientKey)},${escapeCsvCell(t.name)},${escapeCsvCell(t.email)},${escapeCsvCell(t.token, true)}`
        )
        .join("\n");
      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      setDownloadBlobUrl(url);

      // Trigger instant download
      const a = document.createElement("a");
      a.href = url;
      a.download = `claim-tokens-revision-${revision}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("Tokens generated and CSV downloaded");
    } catch (err: any) {
      toast.error("Token Generation Failed", err.message || "Failed to generate tokens");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAck = async () => {
    if (!confirmedDownloaded) return;
    try {
      setIsAcknowledging(true);
      await onAcknowledge(revision);
      toast.success("Token Export Acknowledged", "Credential set is now ready for portal activation.");
    } catch (err: any) {
      toast.error("Acknowledgment Failed", err.message || "Could not lock token export");
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (status === "ready") {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600" weight="fill" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Generated Tokens Active (Revision {revision})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Raw secrets have been purged from memory and export is locked. Verifiers are active.
              </p>
            </div>
          </div>
          {onRotatePrompt && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRotatePrompt}
              disabled={disabled}
              className="text-xs gap-1.5"
            >
              <ArrowClockwise className="w-3.5 h-3.5" />
              <span>Rotate Tokens</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            One-Time Cryptographic Token Export
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            EmitDocs adheres strictly to zero plaintext credential persistence. When you generate tokens, you must download and securely store the CSV. Once acknowledged, raw tokens can never be re-exported.
          </p>
        </div>
      </div>

      {status === "preparing" && (
        <div className="pt-2">
          <Button
            onClick={handleGenerate}
            disabled={disabled || isGenerating}
            className="text-xs gap-2 font-bold"
          >
            {isGenerating ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            <span>Generate &amp; Download Token CSV</span>
          </Button>
        </div>
      )}

      {status === "awaiting_export_ack" && (
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Alert variant="warning" title="Export Acknowledgment Required">
            <p className="text-xs">
              Ensure you have downloaded and backed up the token CSV. If lost, you must rotate credentials and invalidate all tokens.
            </p>
          </Alert>

          {downloadBlobUrl && (
            <a
              href={downloadBlobUrl}
              download={`claim-tokens-revision-${revision}.csv`}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Re-download CSV (Session Cached)</span>
            </a>
          )}

          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="confirmExportSaved"
              checked={confirmedDownloaded}
              onChange={(e) => setConfirmedDownloaded(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor="confirmExportSaved"
              className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-relaxed"
            >
              I confirm I have downloaded and safely stored this token CSV. I understand EmitDocs will never display or export these secrets again.
            </label>
          </div>

          <Button
            onClick={handleConfirmAck}
            disabled={!confirmedDownloaded || isAcknowledging || disabled}
            variant="default"
            size="sm"
            className="text-xs gap-2 font-bold"
          >
            {isAcknowledging && <Spinner size="sm" />}
            <span>Confirm &amp; Lock Export</span>
          </Button>
        </div>
      )}
    </div>
  );
}
