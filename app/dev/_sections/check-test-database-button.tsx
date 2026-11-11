"use client";

import { useActionState, useState } from "react";
import { Alert, Button } from "@/lib/ui";
import { checkTestDatabase, type SchemaCheckState } from "../actions";
import s from "../dev.module.css";

// Compares the live and test databases and shows the SQL that adds
// whatever columns the test one is missing.
export function CheckTestDatabaseButton() {
  const [state, run, isPending] = useActionState<SchemaCheckState>(
    () => checkTestDatabase(),
    { status: "idle" },
  );
  const [copied, setCopied] = useState(false);
  const drift = state.status === "done" ? state.drift : null;
  const inStep =
    drift &&
    drift.missingColumns.length === 0 &&
    drift.missingTables.length === 0;

  return (
    <form action={run} className={s.formStack}>
      <div className={s.actions}>
        <Button type="submit" variant="primary" size="sm" loading={isPending}>
          {isPending ? "Checking…" : "Check test database"}
        </Button>
      </div>
      {!isPending && state.status === "error" && (
        <Alert variant="error" title="Couldn't check">
          {state.error}
        </Alert>
      )}
      {!isPending && inStep && (
        <Alert variant="success" title="In step">
          The test database has every table and column the live one has.
        </Alert>
      )}
      {!isPending && drift && !inStep && (
        <>
          {drift.missingColumns.length > 0 && (
            <>
              <Alert
                variant="error"
                title={`${drift.missingColumns.length} missing ${drift.missingColumns.length === 1 ? "column" : "columns"}`}
              >
                Copy this SQL, then run it in the <strong>preview</strong>{" "}
                Supabase project&rsquo;s SQL Editor. It only adds columns. Then
                press Copy to test site now again.
              </Alert>
              <textarea
                readOnly
                value={drift.sql}
                rows={Math.min(14, drift.missingColumns.length + 3)}
                className="w-full rounded-md border border-rule p-3 font-mono text-[13px]"
              />
              <div className={s.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(drift.sql);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy SQL"}
                </Button>
              </div>
            </>
          )}
          {drift.missingTables.length > 0 && (
            <Alert variant="error" title="Missing tables">
              The test database has no {drift.missingTables.join(", ")}. These
              need their migration run on preview (GitHub → Actions → Supabase
              migrations → Run workflow, target preview). If it says the
              database is up to date, ask the developer.
            </Alert>
          )}
        </>
      )}
    </form>
  );
}
