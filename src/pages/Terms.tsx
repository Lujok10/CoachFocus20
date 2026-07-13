import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

type TermsProps = {
  onBack: () => void;
};

export function Terms({ onBack }: TermsProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-6">
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Help
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Terms of Service
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Effective date: July 12, 2026
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm leading-7 text-slate-600">
            These Terms of Service govern your use of Focus20. By creating an
            account or using the service, you agree to these Terms.
          </p>
        </section>

        <TermsSection title="1. Description of the Service">
          <p>
            Focus20 is an AI-powered productivity and focus-coaching
            application. Features may include task planning, focus-session
            recommendations, calendar integration, reminders, achievements,
            voice check-ins, and productivity insights.
          </p>
        </TermsSection>

        <TermsSection title="2. Eligibility">
          <p>
            You must be at least 13 years old to use Focus20. If you are under
            the age of legal majority where you live, you must have permission
            from a parent or legal guardian.
          </p>
        </TermsSection>

        <TermsSection title="3. User Accounts">
          <p>
            You are responsible for maintaining the confidentiality and
            security of your account and for all activity performed through
            your account.
          </p>

          <p>
            You agree to provide accurate information and to promptly update it
            when necessary.
          </p>
        </TermsSection>

        <TermsSection title="4. Acceptable Use">
          <p>You agree not to:</p>

          <ul className="list-disc space-y-2 pl-5">
            <li>Use Focus20 for unlawful, abusive, or fraudulent activity.</li>
            <li>Attempt to gain unauthorized access to accounts or systems.</li>
            <li>Disrupt, overload, or interfere with the service.</li>
            <li>Upload malware or malicious code.</li>
            <li>Reverse engineer or improperly copy the service.</li>
            <li>Use automated methods to abuse service limits.</li>
          </ul>
        </TermsSection>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-600" />

            <div>
              <h2 className="font-black text-amber-950">
                AI Recommendations Disclaimer
              </h2>

              <div className="mt-3 space-y-3 text-sm leading-7 text-amber-900">
                <p>
                  Focus20 recommendations are provided for general productivity
                  and informational purposes only.
                </p>

                <p>
                  Focus20 does not provide medical, mental-health, legal,
                  financial, employment, or professional advice. You remain
                  responsible for your decisions, actions, schedule, and use of
                  the service.
                </p>

                <p>
                  AI-generated content may occasionally be incomplete,
                  inaccurate, or unsuitable for your circumstances.
                </p>
              </div>
            </div>
          </div>
        </section>

        <TermsSection title="5. Calendar Integration">
          <p>
            If you connect Google Calendar, you authorize Focus20 to access and
            use calendar information according to the permissions you grant.
          </p>

          <p>
            Focus20 may create, update, or remove Focus20-created events and
            other events you explicitly authorize Focus20 to manage.
          </p>

          <p>
            You can disconnect Google Calendar from Settings at any time.
          </p>
        </TermsSection>

        <TermsSection title="6. Notifications">
          <p>
            Focus20 may send reminders, focus-session notifications, and
            check-in prompts when you enable notifications. Delivery is not
            guaranteed and may depend on your browser, device, network, and
            operating-system settings.
          </p>
        </TermsSection>

        <TermsSection title="7. User Content">
          <p>
            You retain ownership of task information, notes, voice check-ins,
            and other content you submit.
          </p>

          <p>
            You grant Focus20 permission to process that content only as needed
            to operate, secure, support, and improve the service.
          </p>
        </TermsSection>

        <TermsSection title="8. Intellectual Property">
          <p>
            Focus20, its software, branding, design, and original content are
            owned by Focus20 or its licensors and are protected by applicable
            intellectual-property laws.
          </p>
        </TermsSection>

        <TermsSection title="9. Third-Party Services">
          <p>
            Focus20 relies on third-party services, including Clerk, Neon,
            Render, Vercel, OpenAI, and Google services.
          </p>

          <p>
            Your use of those services may also be subject to their separate
            terms and policies.
          </p>
        </TermsSection>

        <TermsSection title="10. Availability and Changes">
          <p>
            Focus20 may change, suspend, limit, or discontinue features at any
            time. We do not guarantee uninterrupted, error-free, or permanently
            available service.
          </p>
        </TermsSection>

        <TermsSection title="11. Termination">
          <p>
            You may stop using Focus20 at any time.
          </p>

          <p>
            We may suspend or terminate access if these Terms are violated, if
            required by law, or if necessary to protect users or the service.
          </p>
        </TermsSection>

        <TermsSection title="12. Disclaimer of Warranties">
          <p>
            Focus20 is provided on an “as is” and “as available” basis, to the
            fullest extent permitted by law, without warranties of any kind.
          </p>
        </TermsSection>

        <TermsSection title="13. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, Focus20 and its operators
            will not be liable for indirect, incidental, special,
            consequential, or punitive damages, including lost data, lost
            profits, business interruption, or missed opportunities.
          </p>
        </TermsSection>

        <TermsSection title="14. Indemnification">
          <p>
            You agree to indemnify and hold harmless Focus20 and its operators
            from claims arising from your misuse of the service, violation of
            these Terms, or infringement of another party’s rights.
          </p>
        </TermsSection>

        <TermsSection title="15. Governing Law">
          <p>
            These Terms are governed by the laws of the Commonwealth of
            Virginia, United States, without regard to conflict-of-law rules.
          </p>
        </TermsSection>

        <TermsSection title="16. Changes to These Terms">
          <p>
            These Terms may be updated periodically. The effective date at the
            top of the page will be updated when material changes are made.
          </p>
        </TermsSection>

        <TermsSection title="17. Contact">
          <p>Questions about these Terms can be sent to:</p>

          <a
            href="mailto:focus20.ai.coach@gmail.com"
            className="font-bold text-indigo-600 hover:text-indigo-700"
          >
            focus20.ai.coach@gmail.com
          </a>
        </TermsSection>

        <p className="px-4 text-center text-xs leading-5 text-slate-400">
          This page is a general terms template and should be reviewed by a
          qualified attorney before a large public launch.
        </p>
      </main>
    </div>
  );
}

function TermsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>

      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
        {children}
      </div>
    </section>
  );
}