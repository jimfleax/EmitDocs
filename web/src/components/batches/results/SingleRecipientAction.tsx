/**
 * @file SingleRecipientAction.tsx
 * @description Compact table row actions for instant on-demand preview (<20ms) and direct browser file download (PRD-CORE-07).
 * @architecture Action cell component rendered inside RecipientStatusTable to preview or download individual recipient outputs.
 * @agent_note Generates PDF bytes on demand if not pre-rendered, opens SinglePdfPreviewModal, or triggers direct client download.
 */

import { useState } from "react";
import { Eye, DownloadSimple, CircleNotch } from "@phosphor-icons/react";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";
import { toast } from "@/components/ui/toast";
import { SinglePdfPreviewModal } from "./SinglePdfPreviewModal";

export interface SingleRecipientActionProps {
  recipient: {
    recipientKey: string;
    sourceRowNumber?: number;
    effectiveData: Record<string, any>;
  };
  onGenerateSingle: (recipient: {
    recipientKey: string;
    effectiveData: Record<string, any>;
  }) => Promise<{
    pdfBytes: Uint8Array;
    warnings: EngineWarning[];
    durationMs?: number;
  }>;
  disabled?: boolean;
}

/**
 * @component SingleRecipientAction
 * @description Row action button group triggering single recipient on-demand rendering, modal preview, and file download.
 * @param {SingleRecipientActionProps} props - Component properties.
 * @param {Object} props.recipient - Recipient record data.
 * @param {string} props.recipient.recipientKey - Recipient unique identifier.
 * @param {number} [props.recipient.sourceRowNumber] - Source spreadsheet row number.
 * @param {Record<string, any>} props.recipient.effectiveData - Key-value field data for certificate generation.
 * @param {Function} props.onGenerateSingle - Function to synthesize single PDF binary with engine warnings.
 * @param {boolean} [props.disabled=false] - Whether actions are disabled.
 * @state {boolean} isPreviewLoading - Loading spinner state for preview button.
 * @state {boolean} isDownloadLoading - Loading spinner state for download button.
 * @state {boolean} isModalOpen - Visibility state of the SinglePdfPreviewModal.
 * @state {Object | null} previewResult - Generated PDF binary and warnings result object.
 * @returns {JSX.Element} Action button pair with embedded preview modal.
 */
export function SingleRecipientAction({
  recipient,
  onGenerateSingle,
  disabled = false,
}: SingleRecipientActionProps) {
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    pdfBytes: Uint8Array;
    warnings: EngineWarning[];
    durationMs?: number;
  } | null>(null);

  const getRecipientName = (): string => {
    const data = recipient.effectiveData || {};
    return (
      data.name ||
      data.Name ||
      data.studentName ||
      data.recipientName ||
      data.fullName ||
      recipient.recipientKey
    );
  };

  const handlePreview = async () => {
    if (disabled || isPreviewLoading) return;
    try {
      setIsPreviewLoading(true);
      const res = await onGenerateSingle({
        recipientKey: recipient.recipientKey,
        effectiveData: recipient.effectiveData,
      });
      setPreviewResult(res);
      setIsModalOpen(true);
    } catch (err: any) {
      console.error("Preview generation error:", err);
      toast.error(
        `Preview failed for ${recipient.recipientKey}: ${err?.message || "Unknown error"}`,
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = async () => {
    if (disabled || isDownloadLoading) return;
    try {
      setIsDownloadLoading(true);
      const res = await onGenerateSingle({
        recipientKey: recipient.recipientKey,
        effectiveData: recipient.effectiveData,
      });

      const rawName = getRecipientName();
      const sanitizedName = String(rawName).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${sanitizedName}_${recipient.recipientKey}.pdf`;

      const blob = new Blob([res.pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success(`Downloaded ${filename}`);
    } catch (err: any) {
      console.error("Download generation error:", err);
      toast.error(
        `Download failed for ${recipient.recipientKey}: ${err?.message || "Unknown error"}`,
      );
    } finally {
      setIsDownloadLoading(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePreview}
          disabled={disabled || isPreviewLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
          title="Instant Preview (<20ms)"
        >
          {isPreviewLoading ? (
            <CircleNotch size={14} className="animate-spin text-blue-600" />
          ) : (
            <Eye size={14} className="text-slate-500" />
          )}
          <span>Preview</span>
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={disabled || isDownloadLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
          title="Direct Browser Download"
        >
          {isDownloadLoading ? (
            <CircleNotch size={14} className="animate-spin text-blue-600" />
          ) : (
            <DownloadSimple size={14} className="text-slate-500" />
          )}
          <span>Download</span>
        </button>
      </div>

      <SinglePdfPreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recipientKey={recipient.recipientKey}
        recipientName={getRecipientName()}
        pdfBytes={previewResult?.pdfBytes ?? null}
        warnings={previewResult?.warnings ?? []}
        durationMs={previewResult?.durationMs}
      />
    </>
  );
}
