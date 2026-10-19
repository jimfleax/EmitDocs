/**
 * @file $publicSlug.tsx
 * @description Public participant claim portal route for credential verification, real-time PDF preview, and secure download.
 * @architecture Standalone public route resolving dynamic publicSlug parameter with turnstile protection and deterministic rendering.
 * @agent_note Fetches template and render payload client-side to synthesize customized PDF certificates via Web Worker/pdf-lib.
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
import { generatePdfWithOverlay } from "@/lib/pdf-engine/pdf-preview-engine";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";

/**
 * @constant Route
 * @description Public route definition for participant claim portals at "/claim/$publicSlug".
 */
export const Route = createFileRoute("/claim/$publicSlug")({
  component: ParticipantClaimRoute,
});

/**
 * @component ParticipantClaimRoute
 * @description Public claim portal interface with credential entry form, live PDF preview, and download triggers.
 * @state Manages portal metadata, Turnstile state, recipient credentials, synthesis progress, and generated PDF blob URLs.
 * @api Interacts with `/api/public/claim-portals/:slug/verify`, `/render-payload`, and `/template-file`.
 * @returns {JSX.Element} Participant claim portal layout.
 */
function ParticipantClaimRoute() {
  const { publicSlug } = Route.useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [portalMeta, setPortalMeta] = useState<any>(null);
  const [requiresTurnstile, setRequiresTurnstile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<{
    valid: boolean;
    recipientName?: string;
  } | null>(null);

  // PDF Generation State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisStatus, setSynthesisStatus] = useState(
    "Preparing certificate...",
  );
  const [generatedPdfBytes, setGeneratedPdfBytes] = useState<Uint8Array | null>(
    null,
  );
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [serverDownloadUrl, setServerDownloadUrl] = useState<string | null>(
    null,
  );
  const [certificateFilename, setCertificateFilename] = useState<string | null>(
    null,
  );

  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Synthesize customized PDF using the exact template and recipient mappings
  const synthesizeCertificate = useCallback(async () => {
    try {
      setIsSynthesizing(true);
      setSynthesisStatus("Fetching certificate layout and template...");

      // 1. Fetch render payload (mappings & effective data)
      const payloadRes = await fetch(
        `/api/public/claim-portals/${publicSlug}/render-payload`,
      );
      if (!payloadRes.ok)
        throw new Error("Failed to load certificate mappings");
      const payload = await payloadRes.json();

      setCertificateFilename(payload.filename);

      // 2. Fetch base template PDF asset
      setSynthesisStatus("Loading base certificate template...");
      const fileRes = await fetch(
        `/api/public/claim-portals/${publicSlug}/template-file`,
      );
      if (!fileRes.ok) throw new Error("Failed to load base certificate asset");
      const fileAb = await fileRes.arrayBuffer();

      // 3. Stringify effectiveData for overlay engine
      setSynthesisStatus("Mapping verified credentials to certificate...");
      const stringData: Record<string, string> = {};
      if (payload.effectiveData) {
        for (const [k, v] of Object.entries(payload.effectiveData)) {
          stringData[k] = v !== null && v !== undefined ? String(v) : "";
        }
      }

      // 4. Generate custom PDF using EmitDocs preview engine
      const { pdfBytes } = await generatePdfWithOverlay(
        new Uint8Array(fileAb),
        payload.fieldMappings || [],
        stringData,
        { drawDebugBoxes: false },
      );

      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      setGeneratedPdfBytes(pdfBytes);
      setGeneratedPdfUrl(blobUrl);

      // Also get server download URL as backup
      const dlRes = await fetch(
        `/api/public/claim-portals/${publicSlug}/download-url`,
        { method: "POST" },
      );
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        setServerDownloadUrl(dlData.downloadUrl);
      }
    } catch (err: any) {
      console.warn(
        "Client synthesis error, falling back to server download URL:",
        err,
      );
      // Fallback: fetch server download URL
      try {
        const dlRes = await fetch(
          `/api/public/claim-portals/${publicSlug}/download-url`,
          { method: "POST" },
        );
        if (!dlRes.ok) {
          throw new Error("Failed to retrieve download URL");
        }
        const dlData = await dlRes.json();
        if (!dlData?.downloadUrl) {
          throw new Error("Invalid download URL response");
        }
        setServerDownloadUrl(dlData.downloadUrl);
        setCertificateFilename(dlData.filename);
      } catch (fallbackErr: any) {
        console.error("Fallback download URL error:", fallbackErr);
        toast.error(
          "Certificate Preparation Failed",
          "Unable to prepare your certificate for download. Please try again.",
        );
      }
    } finally {
      setIsSynthesizing(false);
    }
  }, [publicSlug]);

  // Load portal metadata & active session
  const loadPortal = useCallback(async () => {
    try {
      setIsLoading(true);
      const metaRes = await fetch(`/api/public/claim-portals/${publicSlug}`);
      if (!metaRes.ok) {
        setHasError(true);
        return;
      }
      const meta = await metaRes.json();
      if (!meta || !meta.success || !meta.portal) {
        setHasError(true);
        return;
      }
      setPortalMeta(meta.portal);
      if (meta.portal.requiresTurnstile) {
        setRequiresTurnstile(true);
      }

      // Check existing session
      const sessRes = await fetch(
        `/api/public/claim-portals/${publicSlug}/session`,
      );
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        if (sessData.valid) {
          setSession(sessData);
          void synthesizeCertificate();
        }
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [publicSlug, synthesizeCertificate]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      await loadPortal();
      if (ignore) return;
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [loadPortal]);

  // Handle access token submission
  const handleClaim = async (creds: {
    primaryCredential: string;
    secondaryCredential?: string;
    turnstileToken?: string;
  }) => {
    try {
      setHasError(false);
      setErrorMessage(null);
      setErrorRequestId(null);
      const res = await fetch(`/api/public/claim-portals/${publicSlug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorRequestId(
          err.requestId || `req_${Math.random().toString(36).slice(2, 8)}`,
        );

        if (err.error?.code === "TURNSTILE_REQUIRED") {
          setRequiresTurnstile(true);
        }

        if (res.status === 429 || err.error?.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter =
            err.error?.retryAfter ?? res.headers.get("retry-after");
          const retryMsg = retryAfter
            ? `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
            : err.error?.message ||
              "Too many claim attempts. Please wait and try again.";
          setErrorMessage(retryMsg);
          toast.error("Rate Limit Exceeded", retryMsg);
        }

        setHasError(true);
        return;
      }

      const data = await res.json();
      setSession({ valid: true, recipientName: data.recipientName });

      // Immediately process and synthesize the custom document
      await synthesizeCertificate();
    } catch {
      setErrorRequestId(`req_${Math.random().toString(36).slice(2, 8)}`);
      setErrorMessage(null);
      setHasError(true);
    }
  };

  const handleDownload = async () => {
    const url = generatedPdfUrl || serverDownloadUrl;
    if (!url) return;

    if (generatedPdfUrl) {
      const a = document.createElement("a");
      a.href = generatedPdfUrl;
      a.download =
        certificateFilename ||
        `${session?.recipientName || "Participant"}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(
        "Certificate Downloaded",
        "Your customized PDF certificate has been saved.",
      );
    } else {
      window.open(url, "_blank");
    }
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

  // Paused / Disabled / Closed / Expired / Ready (Inactive)
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

  const configuredTurnstileSiteKey =
    portalMeta?.turnstileSiteKey ||
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);

  return (
    <PublicClaimLayout
      title={
        session?.valid
          ? portalMeta?.label || "Claim Certificate"
          : portalMeta?.label || "Claim Certificate"
      }
      subtitle={
        session?.valid
          ? "Your custom certificate has been verified and synthesized."
          : portalMeta?.instructions ||
            "Enter your credentials to download your verified certificate."
      }
      maxWidth={session?.valid ? "2xl" : "xl"}
    >
      {isSynthesizing ? (
        <div className="p-8 sm:p-10 rounded-2xl bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center space-y-3.5">
          <div className="flex justify-center">
            <Spinner size="lg" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Generating Your Certificate
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {synthesisStatus}
            </p>
          </div>
        </div>
      ) : session?.valid ? (
        <div className="space-y-6">
          <ClaimSuccessSummary
            eventLabel={portalMeta?.label || "Event"}
            recipientName={session.recipientName || "Participant"}
            expiresAt={portalMeta?.expiresAt}
          />
          <CertificatePreviewPanel
            pdfBytes={generatedPdfBytes || undefined}
            pdfUrl={generatedPdfUrl || serverDownloadUrl || undefined}
            recipientName={session.recipientName}
          />
          <SecureDownloadButton
            onDownload={handleDownload}
            disabled={!generatedPdfUrl && !serverDownloadUrl}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {hasError && (
            <GenericClaimFailure
              requestId={errorRequestId || undefined}
              message={errorMessage || undefined}
              onRetry={() => {
                setHasError(false);
                setErrorMessage(null);
                if (!portalMeta) {
                  void loadPortal();
                }
              }}
            />
          )}

          <PublicClaimCredentialForm
            credentialMode={portalMeta?.credentialMode || "generated_token"}
            primaryFieldLabel={portalMeta?.primaryFieldLabel}
            secondaryFieldLabel={portalMeta?.secondaryFieldLabel}
            requiresTurnstile={requiresTurnstile}
            turnstileSiteKey={configuredTurnstileSiteKey}
            onSubmit={handleClaim}
          />
        </div>
      )}
    </PublicClaimLayout>
  );
}
