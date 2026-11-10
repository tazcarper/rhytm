"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/lib/ui";
import { copyToTestSiteNow, type CopyToTestSiteState } from "../actions";
import s from "../dev.module.css";

// Runs the copy and shows progress, then what happened table by table.
export function CopyToTestSiteButton() {
  const [state, run, isPending] = useActionState<CopyToTestSiteState>(
    () => copyToTestSiteNow(),
    { status: "idle" },
  );
  const failed =
    state.status === "done" ? state.tables.filter((table) => table.error) : [];

  return (
    <form action={run} className={s.formStack}>
      <div className={s.actions}>
        <Button type="submit" variant="primary" size="sm" loading={isPending}>
          {isPending ? "Copying…" : "Copy to test site now"}
        </Button>
      </div>
      {isPending && (
        <p className="m-0 text-[15px] text-gray">
          Copying. This can take up to a minute; keep this page open.
        </p>
      )}
      {!isPending && state.status === "error" && (
        <Alert variant="error" title="Couldn't copy">
          {state.error}
        </Alert>
      )}
      {!isPending && state.status === "done" && (
        <>
          <Alert
            variant={failed.length ? "error" : "success"}
            title={
              failed.length ? "Copied, with some problems" : "Test site updated"
            }
          >
            {failed.length
              ? `${failed.length} ${failed.length === 1 ? "table" : "tables"} didn't copy. See below.`
              : "Everything copied."}
          </Alert>
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr>
                <th className="py-1 pr-3">Table</th>
                <th className="py-1 pr-3">Updated</th>
                <th className="py-1 pr-3">Added</th>
                <th className="py-1 pr-3">Skipped</th>
                <th className="py-1 pr-3">Kept as is</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {state.tables.map((table) => (
                <tr key={table.table} className="border-t border-rule">
                  <td className="py-1 pr-3 font-mono">{table.table}</td>
                  <td className="py-1 pr-3">{table.updated}</td>
                  <td className="py-1 pr-3">{table.added}</td>
                  <td className="py-1 pr-3">{table.skipped}</td>
                  <td className="py-1 pr-3">{table.kept ?? ""}</td>
                  <td className="py-1">
                    {table.error && (
                      <span className="text-accent-error">{table.error}</span>
                    )}
                    {table.missingColumns?.length ? (
                      <span className="text-gray">
                        {" "}
                        Not on the test site yet, left out:{" "}
                        {table.missingColumns.join(", ")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </form>
  );
}
