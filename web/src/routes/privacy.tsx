/**
 * @file privacy.tsx
 * @description Official Privacy Policy legal document detailing data minimization, retention, and subprocessors.
 * @architecture Public legal route utilizing LegalLayout with table-of-contents navigation and retention diagrams.
 * @agent_note Explains GDPR, CCPA, zero AI model training policies, and 30-day default document purge mechanics.
 */

import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { LegalSubprocessorTable } from "@/components/legal/LegalSubprocessorTable";
import { LegalRetentionDiagram } from "@/components/legal/LegalRetentionDiagram";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const SECTIONS = [
  { id: "overview", number: 1, title: "Overview & Privacy Commitment" },
  { id: "categories", number: 2, title: "Information We Collect" },
  {
    id: "recipient-data",
    number: 3,
    title: "Recipient Data & Log Sanitization",
  },
  { id: "cookies", number: 4, title: "Cookies & Tracking Technologies" },
  { id: "purposes", number: 5, title: "How We Use Your Information" },
  { id: "ai-governance", number: 6, title: "AI & Zero Model Training" },
  { id: "subprocessors", number: 7, title: "Sub-Processors & Infrastructure" },
  { id: "retention", number: 8, title: "Retention & Account Deletion" },
  { id: "user-rights", number: 9, title: "Your Global Privacy Rights" },
  { id: "contact", number: 10, title: "Contact Our Privacy Officer" },
];

/**
 * @component PrivacyPage
 * @description Comprehensive Privacy Policy page with section bookmarks, retention diagrams, and subprocessor audits.
 * @returns {JSX.Element} Formatted legal document layout.
 */
export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="At EmitDocs, data minimization and privacy by design are fundamental principles. We explain how your data is collected, handled, and deleted."
      lastUpdated="October 12, 2026"
      version="v1.0.0"
      activeDoc="privacy"
      sections={SECTIONS}
    >
      {/* 1. Overview & Commitment to Privacy */}
      <LegalSection
        id="overview"
        sectionNumber={1}
        title="Overview & Privacy Commitment"
        tldr="We treat your document designs, recipient lists, and issued files with strict data minimization and privacy by design. We do not sell your personal data."
      >
        <p>
          EmitDocs (<strong>"EmitDocs"</strong>, <strong>"we"</strong>,{" "}
          <strong>"us"</strong>, or <strong>"our"</strong>) respects your
          privacy and is committed to protecting the personal data of visitors,
          organizers, developers, and document recipients.
        </p>
        <p>
          This Privacy Policy explains what personal information we collect
          through our web application, APIs, and worker runtimes, how we process
          and store it, when we erase it, and the statutory rights available to
          you under global regulations, including the European Union General
          Data Protection Regulation (<strong>GDPR</strong>), UK GDPR, and the
          California Consumer Privacy Act (<strong>CCPA/CPRA</strong>).
        </p>
        <p>
          <strong>Controller vs. Processor Roles:</strong> For account details,
          billing, and session security, EmitDocs acts as a{" "}
          <em>Data Controller</em>. For uploaded spreadsheet datasets and
          recipient lists processed on behalf of an organizer, EmitDocs operates
          strictly as a <em>Data Processor / Service Provider</em>.
        </p>
      </LegalSection>

      {/* 2. Categories of Information Collected */}
      <LegalSection
        id="categories"
        sectionNumber={2}
        title="Information We Collect"
        tldr="We collect account details from Google OAuth, template and spreadsheet files you upload to generate documents, and minimal telemetry. We never collect or store user passwords."
      >
        <p>We collect information across three specific tiers:</p>
        <div className="space-y-3 my-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
              Tier 1: Account & Profile Information
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              When you sign in using Google Identity Services via Better Auth,
              we receive your Google Subject ID (<code>sub</code>), full name,
              verified email address, and profile picture URL. We store no
              passwords.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
              Tier 2: Job Content & Recipient Datasets
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              PDF template artwork, fonts, CSV/XLSX spreadsheets, mapped column
              names, recipient field values (e.g., student names, dates,
              identification numbers), manual overrides, and compiled output
              PDFs.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
              Tier 3: Technical & Operational Telemetry
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              IP addresses (anonymized and truncated in logs), browser
              User-Agent strings (recorded in session records for authentication
              security), request latency, and client Web Vitals via Vercel Speed
              Insights.
            </p>
          </div>
        </div>
      </LegalSection>

      {/* 3. Recipient Data Protection & Log Sanitization Mandate */}
      <LegalSection
        id="recipient-data"
        sectionNumber={3}
        title="Recipient Data & Log Sanitization"
        tldr="Spreadsheets containing attendee/recipient PII are processed ephemerally. Our production logs strictly scrub all raw recipient names, emails, row data, and storage tokens."
      >
        <p>
          Organizers frequently process spreadsheets containing third-party
          personal data (such as student, employee, or event attendee names). We
          enforce strict privacy boundaries around recipient data:
        </p>
        <ul className="list-disc list-inside space-y-2 text-slate-700 pl-2">
          <li>
            <strong>Ephemeral Processing:</strong> Tabular recipient data
            uploaded via CSV or XLSX is stored only as long as needed to preview
            drafts, approve immutable snapshots, and execute PDF generation.
          </li>
          <li>
            <strong>Strict Log Sanitization:</strong> Our application monitoring
            and serverless function logs are programmatically scrubbed. Under no
            circumstances do production logs contain raw spreadsheet rows,
            recipient names, emails, signed Cloudflare R2 storage URLs, or auth
            session tokens.
          </li>
          <li>
            <strong>Zero Secondary Utilization:</strong> EmitDocs never
            cross-references, aggregates, or monetizes recipient information.
          </li>
        </ul>
      </LegalSection>

      {/* 4. Cookies & Web Storage */}
      <LegalSection
        id="cookies"
        sectionNumber={4}
        title="Cookies & Tracking Technologies"
        tldr="We use only strictly necessary HttpOnly cookies for session authentication. We do NOT use advertising pixels, cross-site trackers, or data-broker cookies."
      >
        <p>EmitDocs maintains a privacy-first approach to browser storage:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-700 pl-2">
          <li>
            <strong>Strictly Necessary Authentication Cookies:</strong> Better
            Auth issues an encrypted, opaque session cookie (
            <code>better-auth.session_token</code>) configured with{" "}
            <code>HttpOnly</code>, <code>Secure</code>, and{" "}
            <code>SameSite=Lax</code> attributes. This cookie is used
            exclusively to maintain your authenticated login state.
          </li>
          <li>
            <strong>Local Browser Storage:</strong> Local storage and Web Worker
            memory are utilized exclusively to cache font glyphs, PDF template
            bytes, and active batch chunk progress during your browser session.
          </li>
          <li>
            <strong>No Third-Party Ad Networks:</strong> EmitDocs does not
            deploy advertising trackers, remarketing pixels (no Meta Pixel, no
            Google Ads remarketing), or behavioral cross-site profiling scripts.
          </li>
        </ul>
      </LegalSection>

      {/* 5. How We Use Your Information */}
      <LegalSection
        id="purposes"
        sectionNumber={5}
        title="How We Use Your Information"
        tldr="Your information is used strictly to provide the document generation service, authenticate your session, maintain platform security, and send essential transactional notices."
      >
        <p>We process personal data only under recognized legal bases:</p>
        <div className="overflow-x-auto my-4 rounded-xl border border-slate-200/80">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
              <tr>
                <th className="py-2.5 px-3">Processing Purpose</th>
                <th className="py-2.5 px-3">Data Categories</th>
                <th className="py-2.5 px-3">GDPR Legal Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  Document generation &amp; batch issuance
                </td>
                <td className="py-2.5 px-3">
                  PDF templates, spreadsheets, recipient data
                </td>
                <td className="py-2.5 px-3">
                  Performance of a contract (Art. 6(1)(b))
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  Single Sign-On authentication &amp; session security
                </td>
                <td className="py-2.5 px-3">
                  Google OAuth subject ID, email, IP address
                </td>
                <td className="py-2.5 px-3">
                  Performance of a contract &amp; Legitimate interest
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  Immutable audit records &amp; snapshot verification
                </td>
                <td className="py-2.5 px-3">
                  Snapshot hashes, version IDs, batch timestamps
                </td>
                <td className="py-2.5 px-3">
                  Legitimate interest (Art. 6(1)(f))
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  Service reliability, quota enforcement &amp; anti-abuse
                </td>
                <td className="py-2.5 px-3">
                  Truncated IP logs, worker error codes, telemetry
                </td>
                <td className="py-2.5 px-3">
                  Legitimate interest (Art. 6(1)(f))
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      {/* 6. AI & Zero Model Training */}
      <LegalSection
        id="ai-governance"
        sectionNumber={6}
        title="AI & Zero Model Training"
        tldr="EmitDocs explicitly guarantees that your uploaded document designs, spreadsheets, and recipient PII are NEVER used to train foundational AI or machine learning models."
      >
        <p>
          For educational institutions, organizers, and enterprise developers,
          confidentiality is non-negotiable. EmitDocs operates under a formal
          Zero Model Training Policy:
        </p>
        <ul className="list-disc list-inside space-y-2 text-slate-700 pl-2">
          <li>
            <strong>No Foundation Model Training:</strong> Your PDF templates,
            recipient personal details, and compiled documents are{" "}
            <strong>never</strong> used to train, retrain, fine-tune, or improve
            public foundation machine learning models.
          </li>
          <li>
            <strong>Ephemeral Token Detection:</strong> Where automated layout
            or token suggestions operate, computations occur in isolated memory
            contexts and are not retained beyond immediate execution.
          </li>
          <li>
            <strong>Tenant Isolation:</strong> Data processed under your account
            is strictly segregated and inaccessible to other tenants.
          </li>
        </ul>
      </LegalSection>

      {/* 7. Sub-Processors & Infrastructure Sharing */}
      <LegalSection
        id="subprocessors"
        sectionNumber={7}
        title="Sub-Processors & Infrastructure"
        tldr="We share data only with verified cloud infrastructure providers essential for hosting, database storage, and file processing. We never sell data to advertising brokers."
      >
        <p>
          EmitDocs partners with industry-leading cloud infrastructure providers
          to host and operate the Service. All sub-processors are vetted and
          bound by Data Processing Addenda (DPAs) with strict confidentiality
          and security requirements:
        </p>
        <LegalSubprocessorTable />
      </LegalSection>

      {/* 8. Retention & Account Deletion */}
      <LegalSection
        id="retention"
        sectionNumber={8}
        title="Retention & Account Deletion"
        tldr="Batch files enforce strict 24h, 7d, or 30d retention presets. Download links are immediately revoked at expiry, followed by physical cloud deletion. Account deletion permanently purges all owned data."
      >
        <p>
          EmitDocs enforces a deterministic, automated data lifecycle designed
          around the <strong>PRD-CORE-09</strong> retention specification:
        </p>
        <LegalRetentionDiagram />
        <ul className="list-disc list-inside space-y-2 text-slate-700 pl-2">
          <li>
            <strong>Job Retention Presets:</strong> Organizers select one of
            three strict presets for each issuance job:{" "}
            <strong>24 hours</strong>, <strong>7 days (default)</strong>, or{" "}
            <strong>30 days (maximum)</strong>.
          </li>
          <li>
            <strong>Logical Expiry vs. Physical Erasure:</strong> At the exact
            retention deadline, access is instantly revoked ("Logical Expiry"),
            preventing new download URLs. An automated daily cleanup sweep
            permanently erases physical storage objects from Cloudflare R2 and
            MongoDB recipient rows ("Physical Deletion").
          </li>
          <li>
            <strong>Account Deletion:</strong> You may request complete account
            deletion via your Account Settings. Upon confirmation, active
            sessions are invalidated immediately, and all owned templates, batch
            configurations, and files are permanently scheduled for irreversible
            physical deletion.
          </li>
        </ul>
      </LegalSection>

      {/* 9. Your Global Privacy Rights */}
      <LegalSection
        id="user-rights"
        sectionNumber={9}
        title="Your Global Privacy Rights"
        tldr="You have full rights under GDPR and CCPA/CPRA to access, export, correct, and delete your personal data. EmitDocs does not sell personal information."
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">
              A. European Economic Area (GDPR) &amp; UK GDPR Rights
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-2">
              If you reside in the EEA or UK, Articles 15–22 of the GDPR grant
              you the following rights:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 space-y-1 pl-2">
              <li>
                <strong>Right of Access:</strong> Request a copy of the personal
                data we hold about you.
              </li>
              <li>
                <strong>Right to Rectification:</strong> Request correction of
                inaccurate information.
              </li>
              <li>
                <strong>Right to Erasure ("Right to be Forgotten"):</strong>{" "}
                Request permanent deletion of your data.
              </li>
              <li>
                <strong>Right to Data Portability:</strong> Obtain your data in
                a structured, machine-readable JSON/CSV format.
              </li>
              <li>
                <strong>Right to Object:</strong> Object to processing based on
                legitimate interests.
              </li>
              <li>
                <strong>Supervisory Complaints:</strong> Lodge a complaint with
                a data protection authority in your EU member state or the UK
                ICO.
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h4 className="font-semibold text-sm text-slate-900 mb-1">
              B. California Consumer Privacy Act (CCPA / CPRA)
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-2">
              California residents possess specific rights regarding personal
              information:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 space-y-1 pl-2">
              <li>
                <strong>Right to Know &amp; Delete:</strong> Request disclosure
                of collected categories and request deletion.
              </li>
              <li>
                <strong>Notice of Non-Sale &amp; Non-Sharing:</strong>{" "}
                <span className="font-semibold text-slate-800">
                  EmitDocs does NOT sell your personal information and does NOT
                  share personal information for cross-context behavioral
                  advertising.
                </span>{" "}
                We have not sold or shared personal information in the preceding
                12 months.
              </li>
              <li>
                <strong>Non-Discrimination:</strong> You will never receive
                discriminatory treatment or diminished service quality for
                exercising your privacy rights.
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h4 className="font-semibold text-sm text-slate-900 mb-1">
              C. International Data Transfers
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              When personal data is transferred across borders to countries
              without an adequacy decision, EmitDocs relies on European
              Commission Standard Contractual Clauses (SCCs) and robust
              technical safeguards.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h4 className="font-semibold text-sm text-slate-900 mb-1">
              D. Children's Privacy (COPPA)
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              EmitDocs is designed for developers, event organizers, educators,
              and enterprise administrators. The Service is not directed to
              children under 13 (or under 16 in the EEA). We do not knowingly
              collect personal data from children.
            </p>
          </div>
        </div>
      </LegalSection>

      {/* 10. Contact Our Privacy Officer */}
      <LegalSection
        id="contact"
        sectionNumber={10}
        title="Contact Our Privacy Officer"
        tldr="To exercise your data subject rights (access, deletion, portability) or submit privacy inquiries, email our privacy team. We respond within 30 days."
      >
        <p>
          If you have questions, comments, or wish to submit a formal Data
          Subject Access Request (DSAR), please contact our Data Protection
          Officer:
        </p>
        <div className="mt-4 p-5 rounded-2xl bg-slate-100 border border-slate-200/80 text-xs sm:text-sm text-slate-700 space-y-2">
          <div className="font-bold text-slate-900 text-sm">
            EmitDocs Privacy Department
          </div>
          <div>
            Email:{" "}
            <a
              href="mailto:privacy@emitdocs.com"
              className="text-blue-600 hover:underline font-mono font-medium"
            >
              privacy@emitdocs.com
            </a>
          </div>
          <div>
            Security Reports:{" "}
            <a
              href="mailto:security@emitdocs.com"
              className="text-blue-600 hover:underline font-mono font-medium"
            >
              security@emitdocs.com
            </a>
          </div>
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
            Response Window: Formal data privacy requests are acknowledged
            within 72 hours and processed within thirty (30) days.
          </div>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
