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
            Delete your Focus20 account
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Focus20 allows you to permanently delete your account and
            associated personal data directly from the app.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-black text-slate-900">
              How to delete your account
            </h2>

            <ol className="mt-4 space-y-3 text-slate-700">
              <li>1. Sign in to your Focus20 account.</li>
              <li>2. Open <strong>Settings</strong>.</li>
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

          <section className="mt-8 rounded-2xl bg-red-50 p-5">
            <h2 className="font-black text-slate-900">
              What will be deleted?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              Deleting your account permanently removes your Focus20 account
              and associated data, including tasks, focus history,
              preferences, analytics data, calendar connection information,
              notification data, and other account-related information.
            </p>
          </section>

          <section className="mt-6 rounded-2xl bg-slate-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div>
                <h2 className="font-black text-slate-900">
                  Account deletion is permanent
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Once your account is deleted, the deletion cannot be undone.
                  You may create a new Focus20 account later, but previously
                  deleted account data cannot be restored.
                </p>
              </div>
            </div>
          </section>

          <p className="mt-8 text-xs leading-5 text-slate-500">
            This page applies to Focus20 accounts and is provided as the
            external account-deletion information page for Focus20 users.
          </p>
        </div>
      </div>
    </main>
  );
}