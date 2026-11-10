// The test database can lag behind the live one by a migration or two. When
// a write names a column the test database doesn't have, PostgREST answers
// "Could not find the 'x' column of 'y' in the schema cache". Drop that
// column and try again, so one missing column doesn't stop the whole copy,
// and report which columns were left out.

type Row = Record<string, unknown>;
type WriteResult = { error: { message: string } | null };

const UNKNOWN_COLUMN = /Could not find the '([^']+)' column/;

export async function writeSkippingMissingColumns(
  rows: Row[],
  write: (rows: Row[]) => PromiseLike<WriteResult>,
  skipped: Set<string> = new Set(),
): Promise<{ error: string | null; skipped: Set<string> }> {
  let current = rows.map((row) => withoutColumns(row, skipped));
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const { error } = await write(current);
    const column = error?.message.match(UNKNOWN_COLUMN)?.[1];
    if (!error) return { error: null, skipped };
    if (!column || skipped.has(column)) return { error: error.message, skipped };
    skipped.add(column);
    current = current.map((row) => withoutColumns(row, skipped));
  }
  return { error: "Too many columns missing on the test site.", skipped };
}

function withoutColumns(row: Row, columns: Set<string>): Row {
  if (columns.size === 0) return row;
  return Object.fromEntries(Object.entries(row).filter(([column]) => !columns.has(column)));
}
