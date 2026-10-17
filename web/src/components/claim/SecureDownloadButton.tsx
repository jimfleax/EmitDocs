/**
 * @file SecureDownloadButton.tsx
 * @description Downloads authorized PDF via object URL or signed URL.
 */

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

export interface SecureDownloadButtonProps {
  onDownload: () => Promise<void>;
  filename?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SecureDownloadButton({
  onDownload,
  isLoading = false,
  disabled = false,
}: SecureDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleClick = async () => {
    try {
      setDownloading(true);
      await onDownload();
    } catch (err: any) {
      toast.error("Download Failed", err.message || "Failed to retrieve certificate");
    } finally {
      setDownloading(false);
    }
  };

  const busy = isLoading || downloading;

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || busy}
      className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
    >
      {busy ? <Spinner size="sm" /> : <DownloadSimple className="w-4 h-4" weight="bold" />}
      <span>Download PDF Certificate</span>
    </Button>
  );
}
