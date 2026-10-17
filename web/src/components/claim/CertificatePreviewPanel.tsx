/**
 * @file CertificatePreviewPanel.tsx
 * @description High-fidelity PDF viewer using HTML5 canvas or PDF iframe.
 */

import { useState } from "react";
import { FilePdf, ArrowsOut } from "@phosphor-icons/react";

export interface CertificatePreviewPanelProps {
  pdfUrl?: string;
  recipientName?: string;
}

export function CertificatePreviewPanel({
  pdfUrl,
  recipientName,
}: CertificatePreviewPanelProps) {
  const [, setIsFullscreen] = useState(false);

  if (!pdfUrl) {
    return (
      <div className="w-full aspect-[4/3] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400">
        <FilePdf className="w-8 h-8 text-slate-300" />
        <span className="text-xs">Preparing certificate preview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Document Preview
        </span>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(true);
            window.open(pdfUrl, "_blank");
          }}
          className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer"
        >
          <ArrowsOut className="w-3 h-3" />
          <span>Full Window</span>
        </button>
      </div>

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-md">
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          title={`Certificate Preview for ${recipientName || "Participant"}`}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
