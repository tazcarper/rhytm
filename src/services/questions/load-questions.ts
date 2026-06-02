import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Reads the client-question archive in `plan/questions/` from disk and
// returns it as clean domain types. Single responsibility: locate, read,
// and parse the markdown files — no rendering, no clipboard, no routing.
//
// On-disk shape (see plan/questions/README.md):
//   plan/questions/<YYYY-MM-DD>/[<category-slug>/]<id>-<slug>.md
//   plan/questions/<YYYY-MM-DD>/README.md   (batch intro)

const QUESTIONS_ROOT = path.join(process.cwd(), "plan", "questions");
const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;
const INDEX_FILE = "README.md";

export interface QuestionDoc {
  /** File slug without extension, e.g. "q1-from-address". Stable anchor id. */
  id: string;
  /** First `# ` heading in the file. */
  title: string;
  /** The `**Category:**` field, falling back to the folder name. */
  category: string;
  /** The `**Status:**` field, as plain text (markdown emphasis stripped). */
  status: string;
  /** Full markdown body of the question file. */
  markdown: string;
}

export interface QuestionBatch {
  /** Folder name, e.g. "2026-06-01". */
  date: string;
  /** The batch README.md, if present. */
  intro: string | null;
  questions: QuestionDoc[];
}

function firstHeading(markdown: string): string | null {
  for (const line of markdown.split("\n")) {
    const match = line.match(/^#\s+(.*)$/);
    if (match) return match[1].trim();
  }
  return null;
}

function fieldValue(markdown: string, field: string): string | null {
  const pattern = new RegExp(`^\\*\\*${field}:\\*\\*\\s*(.+)$`, "m");
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function stripEmphasis(value: string): string {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function readableCategory(folderName: string): string {
  return folderName.replace(/-/g, " ");
}

function buildDoc(
  fileName: string,
  markdown: string,
  fallbackCategory: string,
): QuestionDoc {
  const id = fileName.replace(/\.md$/, "");
  return {
    id,
    title: firstHeading(markdown) ?? id,
    category: fieldValue(markdown, "Category") ?? fallbackCategory,
    status: stripEmphasis(fieldValue(markdown, "Status") ?? ""),
    markdown,
  };
}

async function collectQuestionFiles(
  dir: string,
  fallbackCategory: string,
): Promise<QuestionDoc[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const docs: QuestionDoc[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectQuestionFiles(
        full,
        readableCategory(entry.name),
      );
      docs.push(...nested);
    } else if (entry.name.endsWith(".md") && entry.name !== INDEX_FILE) {
      const markdown = await readFile(full, "utf8");
      docs.push(buildDoc(entry.name, markdown, fallbackCategory));
    }
  }

  return docs;
}

async function readIntro(dir: string): Promise<string | null> {
  try {
    return await readFile(path.join(dir, INDEX_FILE), "utf8");
  } catch {
    return null;
  }
}

/** All question batches, newest date first. */
export async function loadQuestionBatches(): Promise<QuestionBatch[]> {
  const entries = await readdir(QUESTIONS_ROOT, { withFileTypes: true });
  const batches: QuestionBatch[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !DATE_DIR.test(entry.name)) continue;
    const dir = path.join(QUESTIONS_ROOT, entry.name);
    const questions = await collectQuestionFiles(dir, entry.name);
    questions.sort((first, second) => first.id.localeCompare(second.id));
    batches.push({
      date: entry.name,
      intro: await readIntro(dir),
      questions,
    });
  }

  batches.sort((first, second) => second.date.localeCompare(first.date));
  return batches;
}

/** A single batch by its date folder name, or null if it doesn't exist. */
export async function loadQuestionBatch(
  date: string,
): Promise<QuestionBatch | null> {
  if (!DATE_DIR.test(date)) return null;
  const batches = await loadQuestionBatches();
  return batches.find((batch) => batch.date === date) ?? null;
}
