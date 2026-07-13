import { ArrowLeft, Calendar, Database, Shield } from "lucide-react";

type PrivacyProps = {
  onBack: () => void;
};

export function Privacy({ onBack }: PrivacyProps) {
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Privacy Policy
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
            Focus20 is an AI-powered productivity application. This Privacy
            Policy explains what information Focus20 collects, how it is used,
            and the choices available to you.
          </p>
        </section>

        <PolicySection title="Information We Collect">
          <h3 className="font-bold text-slate-900">Account information</h3>

          <p>
            When you create an account, Focus20 may receive your name, email
            address, account identifier, and authentication information through
            Clerk.
          </p>

          <h3 className="mt-4 font-bold text-slate-900">
            Productivity information
          </h3>

          <p>
            Focus20 may store tasks, focus sessions, session completion
            results, needle-mover feedback, voice check-in notes, preferences,
            achievements, streaks, and productivity analytics.
          </p>

          <h3 className="mt-4 font-bold text-slate-900">
            Technical information
          </h3>

          <p>
            Focus20 may process browser information, device information, IP
            address, application logs, error information, notification status,
            and usage events needed to operate and secure the service.
          </p>
        </PolicySection>

        <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <div className="flex items-start gap-3">
            <Calendar className="mt-1 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <h2 className="font-black text-blue-950">
                Google Calendar Information
              </h2>

              <div className="mt-3 space-y-3 text-sm leading-7 text-blue-900">
                <p>
                  When you connect Google Calendar, Focus20 may access calendar
                  availability, busy periods, and calendar-event information
                  required to recommend and reserve focus time.
                </p>

                <p>
                  With read and write permission, Focus20 may create, update, or
                  remove calendar events that Focus20 created, or events you
                  explicitly authorize Focus20 to manage.
                </p>

                <p>
                  Focus20 does not sell Google Calendar data or use it for
                  advertising.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PolicySection title="Voice Check-Ins">
          <p>
            Microphone access is activated only when you start a voice
            check-in. Focus20 does not continuously listen in the background.
          </p>

          <p>
            Voice recordings or transcripts may be processed to understand your
            focus-session outcome and generate coaching feedback. Depending on
            the feature being used, this processing may involve OpenAI.
          </p>
        </PolicySection>

        <PolicySection title="How We Use Information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide focus recommendations and productivity coaching.</li>
            <li>Identify available calendar windows.</li>
            <li>Create and manage protected focus blocks.</li>
            <li>Calculate streaks, achievements, readiness, and insights.</li>
            <li>Send reminders and application notifications.</li>
            <li>Maintain application security and prevent abuse.</li>
            <li>Diagnose errors and improve application performance.</li>
          </ul>
        </PolicySection>

        <section className="rounded-3xl border border-violet-100 bg-violet-50 p-6">
          <div className="flex items-start gap-3">
            <Database className="mt-1 h-5 w-5 shrink-0 text-violet-600" />

            <div>
              <h2 className="font-black text-violet-950">
                Service Providers
              </h2>

              <p className="mt-3 text-sm leading-7 text-violet-900">
                Focus20 currently uses Clerk for authentication, Neon for
                database hosting, Render for the backend API, Vercel for
                frontend hosting, OpenAI for selected AI features, and Google
                Cloud services for Google Calendar integration.
              </p>
            </div>
          </div>
        </section>

        <PolicySection title="Data Sharing">
          <p>
            Focus20 does not sell your personal information.
          </p>

          <p>
            Information may be processed by service providers only as needed to
            operate Focus20. Information may also be disclosed when required by
            law, to protect users, or to protect the security and integrity of
            the service.
          </p>
        </PolicySection>

        <PolicySection title="Data Retention and Deletion">
          <p>
            Focus20 retains information for as long as needed to provide the
            service, maintain security, resolve disputes, and meet legal
            obligations.
          </p>

          <p>
            You can disconnect Google Calendar, reset learned patterns, and
            clear productivity history from the Settings page.
          </p>
        </PolicySection>

        <PolicySection title="Security">
          <p>
            Focus20 uses reasonable technical and organizational safeguards to
            protect information. However, no storage or transmission system can
            be guaranteed to be completely secure.
          </p>
        </PolicySection>

        <PolicySection title="Children's Privacy">
          <p>
            Focus20 is not intended for children under 13. We do not knowingly
            collect personal information from children under 13.
          </p>
        </PolicySection>

        <PolicySection title="Changes to This Policy">
          <p>
            This Privacy Policy may be updated periodically. The effective date
            at the top of the page will be updated when material changes are
            made.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            Questions about this Privacy Policy can be sent to:
          </p>

          <a
            href="mailto:focus20.ai.coach@gmail.com"
            className="font-bold text-indigo-600 hover:text-indigo-700"
          >
            focus20.ai.coach@gmail.com
          </a>
        </PolicySection>

        <p className="px-4 text-center text-xs leading-5 text-slate-400">
          This page is a general application-policy template and should be
          reviewed by a qualified attorney before a large public launch.
        </p>
      </main>
    </div>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">
        {title}
      </h2>

      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
        {children}
      </div>
    </section>
  );
}