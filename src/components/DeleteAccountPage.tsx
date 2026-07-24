import { ShieldCheck, Trash2 } from "lucide-react";

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <Trash2 className="h-7 w-7 text-red-600" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-slate-900">
            Delete your Focus20 account or data
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Focus20 gives you two deletion options: you can permanently delete
            your entire account and associated data, or clear selected history
            and activity data while keeping your account active.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-black text-slate-900">
              Delete your entire Focus20 account
            </h2>

            <ol className="mt-4 space-y-3 text-slate-700">
              <li>1. Sign in to your Focus20 account.</li>
              <li>
                2. Open <strong>Settings</strong>.
              </li>
              <li>
                3. Go to the <strong>Privacy &amp; Data</strong> section.
              </li>
              <li>
                4. Select <strong>Delete Account</strong>.
              </li>
              <li>
                5. Type <strong>DELETE</strong> when prompted.
              </li>
              <li>
                6. Select <strong>Delete Forever</strong> to confirm.
              </li>
            </ol>
          </section>

          <section className="mt-6 rounded-2xl bg-red-50 p-5">
            <h2 className="font-black text-slate-900">
              Data deleted with account deletion
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              Deleting your account permanently removes your Focus20 account
              and associated data, including tasks, focus blocks and focus
              history, feedback and check-ins, preferences, analytics and
              activity records, action history, calendar connection
              information, notification data, learned pattern data, queued
              calendar activity, and other account-related information stored
              by Focus20.
            </p>

            <p className="mt-3 text-sm font-semibold text-red-800">
              Account deletion is permanent and cannot be undone.
            </p>
          </section>

          <section className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-lg font-black text-slate-900">
              Delete history and activity data without deleting your account
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              You can also delete selected Focus20 history and activity data
              while keeping your account active.
            </p>

            <ol className="mt-4 space-y-3 text-slate-700">
              <li>1. Sign in to your Focus20 account.</li>
              <li>
                2. Open <strong>Settings</strong>.
              </li>
              <li>
                3. Go to the <strong>Privacy &amp; Data</strong> section.
              </li>
              <li>
                4. Select <strong>Clear User History</strong>.
              </li>
            </ol>
          </section>

          <section className="mt-6 rounded-2xl bg-amber-50 p-5">
            <h2 className="font-black text-slate-900">
              Data deleted when you clear user history
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              Clear User History removes your Focus20 tasks, focus blocks and
              focus history, feedback and check-ins, analytics and activity
              events, action history, and queued calendar-write history.
            </p>

            <h3 className="mt-4 text-sm font-black text-slate-900">
              Data that is kept
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              Your Focus20 account remains active. Your account settings,
              preferences, calendar connection, and other account data that is
              not part of the cleared history are preserved.
            </p>
          </section>

          <section className="mt-6 rounded-2xl bg-slate-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <h2 className="font-black text-slate-900">
                  Focus20 data deletion
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Full account deletion is designed to permanently remove the
                  Focus20 account and associated data. Clear User History lets
                  you remove selected activity and history data without
                  deleting the account.
                </p>
              </div>
            </div>
          </section>

          <p className="mt-8 text-xs leading-5 text-slate-500">
            This page applies to Focus20 and provides external instructions for
            requesting full account deletion or deletion of selected user data.
          </p>
        </div>
      </div>
    </main>
  );
}