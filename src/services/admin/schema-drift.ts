// Finds tables and columns the live database has but the test (preview)
// database doesn't (Taz, 2026-11-10). They drift apart when an update is
// run by hand on one database: the test database's migration history can
// say an update ran while its columns were never made, so the migration
// workflow skips it and test sites crash on "column … does not exist".
//
// Reads each database's table list from its REST API description (the
// OpenAPI document Supabase serves at /rest/v1/), so no SQL access is
// needed. Writes the SQL that adds the missing columns, for someone to run
// in the test project's SQL editor. Nothing is changed automatically.

export interface DatabaseAccess {
  url: string;
  key: string;
}

// table → column → Postgres type
type Columns = Map<string, Map<string, string>>;

interface OpenApiDocument {
  definitions?: Record<string, { properties?: Record<string, { format?: string }> }>;
}

export async function readColumns({ url, key }: DatabaseAccess): Promise<Columns> {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: key, Accept: "application/openapi+json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Couldn't read ${url}: ${response.status} ${response.statusText}`);
  const document = (await response.json()) as OpenApiDocument;
  const columns: Columns = new Map();
  for (const [table, definition] of Object.entries(document.definitions ?? {})) {
    columns.set(
      table,
      new Map(Object.entries(definition.properties ?? {}).map(([column, info]) => [column, info.format ?? "text"])),
    );
  }
  return columns;
}

export interface MissingColumn {
  table: string;
  column: string;
  type: string;
}

export interface SchemaDrift {
  missingTables: string[];
  missingColumns: MissingColumn[];
  // ALTER TABLE statements that add the missing columns (nullable, no
  // defaults or checks: enough for a test site to load and save).
  sql: string;
}

export function compareColumns(live: Columns, test: Columns): SchemaDrift {
  const missingTables: string[] = [];
  const missingColumns: MissingColumn[] = [];
  for (const [table, liveColumns] of [...live].sort(([a], [b]) => a.localeCompare(b))) {
    const testColumns = test.get(table);
    if (!testColumns) {
      missingTables.push(table);
      continue;
    }
    for (const [column, type] of liveColumns) {
      if (!testColumns.has(column)) missingColumns.push({ table, column, type });
    }
  }
  return { missingTables, missingColumns, sql: catchUpSql(missingColumns) };
}

function catchUpSql(missing: MissingColumn[]): string {
  if (missing.length === 0) return "";
  const lines = missing.map(
    ({ table, column, type }) =>
      `ALTER TABLE public.${quote(table)} ADD COLUMN IF NOT EXISTS ${quote(column)} ${type};`,
  );
  return [...lines, "", "NOTIFY pgrst, 'reload schema';"].join("\n");
}

const quote = (name: string) => (/^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);

export async function findSchemaDrift(live: DatabaseAccess, test: DatabaseAccess): Promise<SchemaDrift> {
  const [liveColumns, testColumns] = await Promise.all([readColumns(live), readColumns(test)]);
  return compareColumns(liveColumns, testColumns);
}
