/**
 * @file $publicSlug.tsx
 * @description Public participant claim portal route (/claim/:publicSlug).
 */

import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicClaimLayout } from "@/components/claim/PublicClaimLayout";
import { PublicClaimCredentialForm } from "@/components/claim/PublicClaimCredentialForm";
import { GenericClaimFailure } from "@/components/claim/GenericClaimFailure";
import { ClaimSuccessSummary } from "@/components/claim/ClaimSuccessSummary";
import { CertificatePreviewPanel } from "@/components/claim/CertificatePreviewPanel";
import { SecureDownloadButton } from "@/components/claim/SecureDownloadButton";
import { PortalPausedExpiredClosedNotice } from "@/components/claim/PortalPausedExpiredClosedNotice";
import { Spinner } from "@/components/ui/Spinner";

export const Route = createFileRoute("/claim/$publicSlug")({
  component: ParticipantClaimRoute,
});

function ParticipantClaimRoute() {
  const { publicSlug } = Route.useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [portalMeta, setPortalMeta] = useState<any>(null);
  const [session, setSession] = useState<{ valid: boolean; recipientName?: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Load portal metadata & active session
  const loadPortal = useCallback(async () => {
    try {
      setIsLoading(true);
      const metaRes = await fetch(`/api/public/claim-portals/${publicSlug}`);
      if (metaRes.status === 404) {
        setPortalMeta({ status: "disabled" });
        return;
      }
      const meta = await metaRes.json();
      setPortalMeta(meta);

      // Check existing session
      const sessRes = await fetch(`/api/public/claim-portals/${publicSlug}/session`);
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        if (sessData.valid) {
          setSession(sessData);
          // fetch download preview
          const dlRes = await fetch(`/api/public/claim-portals/${publicSlug}/download-url`, { method: "POST" });
          if (dlRes.ok) {
            const dlData = await dlRes.json();
            setDownloadUrl(dlData.downloadUrl);
          }
        }
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [publicSlug]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const handleClaim = async (creds: {
    primaryCredential: string;
    secondaryCredential?: string;
    turnstileToken?: string;
  }) => {
    try {
      setHasError(false);
      setErrorRequestId(null);
      const res = await fetch(`/api/public/claim-portals/${publicSlug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorRequestId(err.requestId || `req_${Math.random().toString(36).slice(2, 8)}`);
        setHasError(true);
        return;
      }

      const data = await res.json();
      setSession({ valid: true, recipientName: data.recipientName });

      // Fetch download url
      const dlRes = await fetch(`/api/public/claim-portals/${publicSlug}/download-url`, { method: "POST" });
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        setDownloadUrl(dlData.downloadUrl);
      }
    } catch {
      setErrorRequestId(`req_${Math.random().toString(36).slice(2, 8)}`);
      setHasError(true);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank");
  };

  if (isLoading) {
    return (
      <PublicClaimLayout>
        <div className="p-12 flex justify-center">
          <Spinner size="lg" />
        </div>
      </PublicClaimLayout>
    );
  }

  // Paused / Disabled / Closed / Expired
  if (portalMeta?.status && portalMeta.status !== "active") {
    return (
      <PublicClaimLayout>
        <PortalPausedExpiredClosedNotice
          status={portalMeta.status}
          portalLabel={portalMeta.label}
          expiresAt={portalMeta.expiresAt}
        />
      </PublicClaimLayout>
    );
  }

  return (
    <PublicClaimLayout
      title={portalMeta?.label || "Claim Certificate"}
      subtitle={portalMeta?.instructions || "Enter your credentials to download your verified certificate."}
    >
      {session?.valid ? (
        <div className="space-y-6">
          <ClaimSuccessSummary
            eventLabel={portalMeta?.label || "Event"}
            recipientName={session.recipientName || "Participant"}
            expiresAt={portalMeta?.expiresAt}
          />
          <CertificatePreviewPanel
            pdfUrl={downloadUrl || undefined}
            recipientName={session.recipientName}
          />
          <SecureDownloadButton
            onDownload={handleDownload}
            disabled={!downloadUrl}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {hasError && (
            <GenericClaimFailure
              requestId={errorRequestId || undefined}
              onRetry={() => setHasError(false)}
            />
          )}

          <PublicClaimCredentialForm
            credentialMode={portalMeta?.credentialMode || "generated_token"}
            primaryFieldLabel={portalMeta?.primaryFieldLabel}
            secondaryFieldLabel={portalMeta?.secondaryFieldLabel}
            requiresTurnstile={portalMeta?.requiresTurnstile}
            turnstileSiteKey={portalMeta?.turnstileSiteKey}
            onSubmit={handleClaim}
          />
        </div>
      )}
    </PublicClaimLayout>
  );
}
