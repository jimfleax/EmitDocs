/**
 * @file terms.tsx
 * @description Comprehensive Terms of Service document governing EmitDocs platform usage and worker execution.
 * @architecture Public legal route using LegalLayout with navigation sidebar and structured section anchors.
 * @agent_note Details user IP ownership, zero model training commitments, acceptable use policies, and billing.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

const SECTIONS = [
  { id: "acceptance", number: 1, title: "Acceptance of Terms & Eligibility" },
  { id: "account", number: 2, title: "Account Registration & Security" },
  { id: "service", number: 3, title: "Description of Service & Engine" },
  { id: "user-content", number: 4, title: "User Content & IP Ownership" },
  { id: "emitdocs-ip", number: 5, title: "EmitDocs Intellectual Property" },
  { id: "acceptable-use", number: 6, title: "Acceptable Use Policy (AUP)" },
  {
    id: "ai-features",
    number: 7,
    title: "Assistive Tools & Accuracy Disclaimers",
  },
  { id: "model-training", number: 8, title: "Zero Model Training Guarantee" },
  { id: "billing", number: 9, title: "Billing, Tiers & Cancellations" },
  { id: "warranties", number: 10, title: "Disclaimer of Warranties" },
  { id: "liability", number: 11, title: "Limitation of Liability" },
  { id: "indemnification", number: 12, title: "Indemnification" },
  { id: "disputes", number: 13, title: "Dispute Resolution & Arbitration" },
  { id: "modifications", number: 14, title: "Modifications & Contact" },
];

/**
 * @component TermsPage
 * @description Terms of Service legal document layout covering platform agreements, liability, and acceptable use.
 * @returns {JSX.Element} Structured legal agreement page.
 */
export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="These Terms govern your access to and use of EmitDocs' document automation platform, Web Worker generation runtimes, and APIs."
      lastUpdated="October 12, 2026"
      version="v1.0.0"
      activeDoc="terms"
      sections={SECTIONS}
    >
      {/* 1. Acceptance of Terms & Eligibility */}
      <LegalSection
        id="acceptance"
        sectionNumber={1}
        title="Acceptance of Terms & Eligibility"
        tldr="By using EmitDocs, signing in with Google, or accessing our APIs, you enter into a binding agreement with EmitDocs. You must be at least 18 years of age and authorized to bind any entity you represent."
      >
        <p>
          These Terms of Service (<strong>"Terms"</strong>) constitute a legally
          binding agreement between you (either individually or on behalf of the
          company, educational institution, nonprofit, or organization you
          represent, collectively <strong>"User"</strong>,{" "}
          <strong>"you"</strong>, or <strong>"your"</strong>) and EmitDocs (
          <strong>"EmitDocs"</strong>, <strong>"we"</strong>,{" "}
          <strong>"us"</strong>, or <strong>"our"</strong>).
        </p>
        <p>
          By accessing or using our websites, web applications, worker runtimes,
          preview utilities, or APIs (collectively, the{" "}
          <strong>"Service"</strong>), you acknowledge that you have read,
          understood, and agree to be bound by these Terms and our{" "}
          <Link
            to="/privacy"
            className="text-blue-600 hover:underline font-medium"
          >
            Privacy Policy
          </Link>
          . If you do not agree to these Terms, you must immediately discontinue
          using the Service.
        </p>
        <p>
          <strong>Eligibility Requirements:</strong> You represent and warrant
          that you are at least 18 years of age (or the legal age of majority in
          your jurisdiction). The Service is strictly not directed to children
          under the age of 13 (or under 16 in the European Economic Area). If
          you are accessing the Service on behalf of a legal entity, you
          represent and warrant that you have full authority to bind that entity
          to these Terms.
        </p>
      </LegalSection>

      {/* 2. Account Registration, Authentication & Security */}
      <LegalSection
        id="account"
        sectionNumber={2}
        title="Account Registration & Security"
        tldr="Authentication is handled passwordlessly via Google Identity Services and Better Auth. You are responsible for all document generation and template activity executed under your active session."
      >
        <p>
          <strong>Single Sign-On Authentication:</strong> Account creation and
          login are provisioned via Google OAuth 2.0 and Better Auth. EmitDocs
          does not request, handle, or store personal user passwords. You are
          responsible for safeguarding the credentials associated with your
          linked Google Account.
        </p>
        <p>
          <strong>Session Integrity:</strong> EmitDocs issues cryptographically
          secure, HttpOnly session cookies to authenticate your requests. You
          agree to notify EmitDocs immediately at{" "}
          <a
            href="mailto:security@emitdocs.com"
            className="text-blue-600 hover:underline font-mono"
          >
            security@emitdocs.com
          </a>{" "}
          if you suspect any unauthorized use of your session or breach of
          security. EmitDocs cannot and will not be liable for any loss or
          damage arising from your failure to protect your Google account
          credentials.
        </p>
        <p>
          <strong>Suspension and Revocation:</strong> EmitDocs reserves the
          right to suspend or terminate accounts, invalidate active session
          tokens, and refuse future access without prior notice if we determine
          that you have breached these Terms, engaged in fraudulent issuance, or
          abused our infrastructure.
        </p>
      </LegalSection>

      {/* 3. Description of Service, Generation Architecture & Service Tiers */}
      <LegalSection
        id="service"
        sectionNumber={3}
        title="Description of Service & Engine"
        tldr="EmitDocs lets you visually map PDF templates, import CSV/XLSX recipient records, and generate documents in bulk. Bounded batches run client-side in browser Web Workers; closing the browser pauses the active run."
      >
        <p>
          <strong>The Platform:</strong> EmitDocs provides a cloud and
          browser-assisted document automation platform allowing users to upload
          text-searchable PDF templates, visually position dynamic field tokens
          (e.g., recipient names, certification dates, identifiers), upload
          tabular datasets (CSV/XLSX), review personalized drafts, freeze
          immutable snapshot digests, and compile individual or bulk PDFs.
        </p>
        <p>
          <strong>Browser-Assisted Worker Execution:</strong> Core document
          compilation operates via client-side Web Workers executing bounded
          batches within your browser sandbox. You acknowledge that closing,
          terminating, or navigating away from the browser window while a batch
          is compiling will pause active generation leases until the session is
          reopened.
        </p>
        <p>
          <strong>Quotas and Rate Limits:</strong> Usage of the Service is
          subject to tier quotas, including maximum spreadsheet row counts,
          template size limits, concurrent worker threads, and API rate limits.
          Attempting to circumvent these limits or artificially inflate compute
          resources is a violation of these Terms.
        </p>
      </LegalSection>

      {/* 4. User Content & Intellectual Property Ownership */}
      <LegalSection
        id="user-content"
        sectionNumber={4}
        title="User Content & IP Ownership"
        tldr="You own 100% of your PDF templates, uploaded spreadsheets, recipient data, and generated documents. You grant EmitDocs only the limited license necessary to host, preview, and generate your files."
      >
        <p>
          <strong>Customer Ownership:</strong> As between you and EmitDocs, you
          retain all right, title, and interest, including all intellectual
          property and proprietary rights, in and to all PDF template files,
          designs, artwork, custom fonts, CSV/XLSX spreadsheets, recipient
          records, text overrides, and final compiled output documents
          (collectively, <strong>"User Content"</strong>).
        </p>
        <p>
          <strong>Limited Processing License:</strong> You grant EmitDocs a
          worldwide, non-exclusive, royalty-free, limited license to host,
          cache, parse, render, process, and transmit User Content solely as
          necessary to: (a) provide and execute the Service requested by you;
          (b) generate preview snapshots and compiled PDF archives; (c) enforce
          retention schedules and prevent abuse; and (d) comply with applicable
          statutory obligations. This license terminates automatically when User
          Content is deleted or purged.
        </p>
        <p>
          <strong>Recipient Consents & Authority:</strong> When importing
          spreadsheets containing third-party personal data (e.g., student,
          attendee, or employee records), you warrant that you have obtained all
          necessary legal notices, consents, and authorizations required under
          applicable privacy statutes (including FERPA, GDPR, and CCPA) to
          upload recipient data for document issuance.
        </p>
      </LegalSection>

      {/* 5. EmitDocs Intellectual Property & Proprietary Rights */}
      <LegalSection
        id="emitdocs-ip"
        sectionNumber={5}
        title="EmitDocs Intellectual Property"
        tldr="EmitDocs owns its web applications, software, glyph-fitting algorithms, user interface, brand assets, and documentation. You may not copy, reverse-engineer, or resell our software."
      >
        <p>
          The Service, including its user interface design, source code,
          coordinate transformation engines, glyph-fitting algorithms, token
          detection heuristics, documentation, trademarks, logos, and visual
          brand assets (<strong>"EmitDocs IP"</strong>), is owned exclusively by
          EmitDocs and protected by international copyright, trademark, and
          intellectual property laws.
        </p>
        <p>
          You agree not to copy, modify, distribute, sell, lease,
          reverse-engineer, decompile, or extract source code from the Service,
          nor remove or alter any copyright or trademark notices displayed on
          the platform.
        </p>
      </LegalSection>

      {/* 6. Acceptable Use Policy (AUP) */}
      <LegalSection
        id="acceptable-use"
        sectionNumber={6}
        title="Acceptable Use Policy (AUP)"
        tldr="Do not use EmitDocs for fraud (e.g. fake diplomas, counterfeit IDs, forged invoices), copyright infringement, malware injection, phishing, or abusive automated scraping."
      >
        <p>You agree not to use the Service directly or indirectly to:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-700 pl-2">
          <li>
            <strong>Fraudulent Issuance:</strong> Create, issue, or distribute
            counterfeit, forged, or misleading documents, including fake
            diplomas, unaccredited academic certificates, unauthorized
            government licenses, fraudulent financial invoices, or deceptive
            employee credentials.
          </li>
          <li>
            <strong>Malicious Code:</strong> Upload templates, spreadsheets, or
            attachments containing viruses, macros, ransomware, trojans,
            corrupted data, or code intended to harm software or hardware.
          </li>
          <li>
            <strong>Intellectual Property Infringement:</strong> Upload PDF
            artwork, logos, trademarks, or commercial font files without proper
            licensing or authorization.
          </li>
          <li>
            <strong>Infrastructure Abuse:</strong> Scrape, crawl, or spider the
            platform using unauthorized automated bots; launch denial-of-service
            (DoS) attacks; or stress generation clusters beyond documented
            quotas.
          </li>
          <li>
            <strong>Spam & Unlawful Messaging:</strong> Use generated files to
            conduct unsolicited bulk messaging or phishing campaigns in
            violation of the CAN-SPAM Act or global anti-spam regulations.
          </li>
        </ul>
      </LegalSection>

      {/* 7. Assistive Features, Automated Suggestions & Disclaimers */}
      <LegalSection
        id="ai-features"
        sectionNumber={7}
        title="Assistive Tools & Accuracy Disclaimers"
        tldr="Automated field token detection and text-fitting suggestions are assistive conveniences. You are solely responsible for reviewing and confirming drafts before issuing final documents."
      >
        <p>
          <strong>Assistive Nature of Field Detection:</strong> EmitDocs
          incorporates automated placeholder recognition (e.g., detecting text
          patterns like <code>{"{{fullName}}"}</code>) and font-fitting
          heuristics. These tools are designed to assist template configuration
          and do not replace user verification.
        </p>
        <p>
          <strong>Mandatory Draft Review:</strong> The platform enforces a draft
          review workflow before generating final documents. You are solely
          responsible for verifying text alignments, line breaks, character
          encodings, font glyph compatibility, and data column mappings before
          approving a batch snapshot.
        </p>
        <p>
          EmitDocs disclaims all liability for errors, typos, misaligned text,
          or unmapped columns resulting from unconfirmed automated suggestions.
        </p>
      </LegalSection>

      {/* 8. Zero Foundational Model Training Guarantee */}
      <LegalSection
        id="model-training"
        sectionNumber={8}
        title="Zero Model Training Guarantee"
        tldr="EmitDocs guarantees that your uploaded PDF templates, spreadsheets, recipient personal data, and generated documents are NEVER used to train or fine-tune public foundation AI models."
      >
        <p>
          Confidentiality is fundamental to EmitDocs. We explicitly warrant and
          represent that:
        </p>
        <div className="rounded-xl bg-slate-900 text-slate-100 p-5 font-mono text-xs space-y-2 my-4">
          <div className="text-emerald-400 font-bold">
            EMITDOCS MODEL TRAINING COMMITMENT:
          </div>
          <div>
            1. NO training, retraining, or fine-tuning of public or foundation
            AI models on customer data.
          </div>
          <div>
            2. Customer PDF templates and spreadsheets are processed in strict
            tenant isolation.
          </div>
          <div>
            3. Ephemeral processing: Data is retained strictly according to your
            configured job retention clock.
          </div>
        </div>
        <p>
          Your proprietary document artwork, attendee registries, and
          confidential organization datasets remain strictly isolated to your
          account.
        </p>
      </LegalSection>

      {/* 9. Billing, Tiers, Cancellations & Refunds */}
      <LegalSection
        id="billing"
        sectionNumber={9}
        title="Billing, Tiers & Cancellations"
        tldr="Free tiers are subject to published resource limits. Any future paid plans are billed in advance on a recurring schedule and can be canceled at any time."
      >
        <p>
          <strong>Tier Structures:</strong> EmitDocs offers free and paid
          subscription plans. Free tiers are subject to hard resource quotas
          (e.g., monthly document limits, spreadsheet row caps, file size
          restrictions).
        </p>
        <p>
          <strong>Recurring Billing & Cancellation:</strong> Paid subscriptions
          are billed in advance on a monthly or annual basis. You may cancel
          your subscription at any time through your account settings.
          Cancellation takes effect at the end of the current prepaid billing
          period.
        </p>
        <p>
          <strong>Refund Policy:</strong> Payments are non-refundable except
          where required by applicable consumer protection laws or in cases of
          extended, verified platform outages. Billing inquiries should be
          directed to{" "}
          <a
            href="mailto:billing@emitdocs.com"
            className="text-blue-600 hover:underline font-mono"
          >
            billing@emitdocs.com
          </a>
          .
        </p>
      </LegalSection>

      {/* 10. Disclaimer of Warranties */}
      <LegalSection
        id="warranties"
        sectionNumber={10}
        title="Disclaimer of Warranties"
        tldr="The service is provided 'AS IS' and 'AS AVAILABLE' without warranties of any kind. We do not guarantee uninterrupted or error-free operation."
      >
        <p className="uppercase text-xs font-semibold tracking-wider text-slate-500">
          Statutory Disclaimer
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE, APIS, WORKER
          RUNTIMES, AND ALL DOCUMENTATION ARE PROVIDED ON AN{" "}
          <strong>"AS IS"</strong> AND <strong>"AS AVAILABLE"</strong> BASIS,
          WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR
          OTHERWISE.
        </p>
        <p>
          EMITDOCS EXPRESSLY DISCLAIMS ALL IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET
          ENJOYMENT, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
          WILL MEET YOUR REQUIREMENTS, OPERATE WITHOUT INTERRUPTION, BE SECURE
          OR DEFECT-FREE, OR THAT BROWSER WORKER GENERATIONS WILL NOT BE
          INTERRUPTED BY CLIENT HARDWARE OR BROWSER TERMINATIONS.
        </p>
      </LegalSection>

      {/* 11. Limitation of Liability */}
      <LegalSection
        id="liability"
        sectionNumber={11}
        title="Limitation of Liability"
        tldr="Our aggregate liability is capped at $100 USD (or fees paid in the preceding 12 months). We are not liable for indirect, consequential, or data loss damages following configured retention deadlines."
      >
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL EMITDOCS,
          ITS OFFICERS, DIRECTORS, EMPLOYEES, AFFILIATES, OR LICENSORS BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, CONSEQUENTIAL, OR
          EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA LOSS, LOSS OF
          GOODWILL, OR WORK STOPPAGE, ARISING OUT OF OR IN CONNECTION WITH THE
          USE OF OR INABILITY TO USE THE SERVICE.
        </p>
        <p>
          UNDER NO CIRCUMSTANCES SHALL EMITDOCS' TOTAL AGGREGATE MONETARY
          LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS EXCEED THE GREATER
          OF: (A) ONE HUNDRED UNITED STATES DOLLARS ($100.00 USD); OR (B) THE
          TOTAL AMOUNT PAID BY YOU TO EMITDOCS FOR THE SERVICE IN THE TWELVE
          (12) MONTHS PRECEDING THE CLAIM.
        </p>
        <p>
          <strong>Retention Purge Acknowledgement:</strong> You specifically
          acknowledge that EmitDocs enforces automated data retention schedules
          (24 hours, 7 days, or 30 days), after which batch outputs and
          recipient PII are permanently erased. EmitDocs has no liability for
          data purged pursuant to configured retention deadlines.
        </p>
      </LegalSection>

      {/* 12. Indemnification */}
      <LegalSection
        id="indemnification"
        sectionNumber={12}
        title="Indemnification"
        tldr="You agree to indemnify and protect EmitDocs from third-party claims or lawsuits resulting from your User Content, recipient data privacy violations, or breach of these Terms."
      >
        <p>
          You agree to defend, indemnify, and hold harmless EmitDocs, its
          affiliates, directors, officers, employees, contractors, and agents
          from and against all third-party claims, liabilities, damages, losses,
          and expenses (including reasonable attorneys' fees) arising out of or
          in connection with:
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
          <li>Your use of and access to the Service;</li>
          <li>
            Your User Content, including claims of copyright, trademark, or
            privacy infringement;
          </li>
          <li>
            Your violation of any applicable law or third-party rights
            (including recipient privacy); or
          </li>
          <li>
            Any fraudulent, unauthorized, or deceptive documents generated under
            your account.
          </li>
        </ul>
      </LegalSection>

      {/* 13. Dispute Resolution, Mandatory Arbitration & Class Action Waiver */}
      <LegalSection
        id="disputes"
        sectionNumber={13}
        title="Dispute Resolution & Arbitration"
        tldr="Disputes will be resolved first via 30-day informal negotiation, then through binding individual arbitration. You agree to waive participation in class action lawsuits."
      >
        <p>
          <strong>Informal Good-Faith Negotiation:</strong> Before filing a
          formal claim, you and EmitDocs agree to attempt to resolve any dispute
          amicably. Written notice must be sent to{" "}
          <a
            href="mailto:legal@emitdocs.com"
            className="text-blue-600 hover:underline font-mono"
          >
            legal@emitdocs.com
          </a>
          . Both parties agree to negotiate in good faith for at least thirty
          (30) days.
        </p>
        <p>
          <strong>Binding Individual Arbitration:</strong> If the dispute is not
          resolved within 30 days, it shall be settled exclusively by
          confidential, binding arbitration administered under the rules of the
          American Arbitration Association (AAA) or an equivalent recognized
          arbitration provider.
        </p>
        <p>
          <strong>Class Action Waiver:</strong> YOU AND EMITDOCS AGREE THAT EACH
          MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND
          NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR
          REPRESENTATIVE PROCEEDING.
        </p>
      </LegalSection>

      {/* 14. Modifications to Terms & Contact */}
      <LegalSection
        id="modifications"
        sectionNumber={14}
        title="Modifications & Contact"
        tldr="We may update these Terms. For material updates, we will give at least 30 days notice. Continued use after changes constitutes acceptance."
      >
        <p>
          EmitDocs reserves the right to revise these Terms at any time. If a
          revision is material, we will provide at least thirty (30) days'
          advance notice via email or a platform announcement banner.
        </p>
        <p>
          Your continued access to or use of the Service following the effective
          date of updated Terms constitutes acceptance of the changes. If you do
          not agree to the revisions, you must discontinue use of the Service.
        </p>
        <div className="mt-4 p-4 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900">
            Legal Contact Information
          </div>
          <div>EmitDocs Legal Department</div>
          <div>
            Email:{" "}
            <a
              href="mailto:legal@emitdocs.com"
              className="text-blue-600 hover:underline font-mono"
            >
              legal@emitdocs.com
            </a>
          </div>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
