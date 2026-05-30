# Client Questions — split-file archive

This folder holds client questions one-per-file, grouped by category. Sister of `plan/client-questions.md` (which is the consolidated single-page index of the same set).

## Convention

```
plan/questions/
  <YYYY-MM-DD>/                     a batch of questions surfaced on this date
    <category-slug>/                category subfolder (only when 2+ questions share a category)
      <id>-<short-slug>.md          one question per file
    README.md                       index of this batch
  README.md                         this file
```

### When adding new questions

- Don't mutate prior dated folders — they're a historical record of what was open on that date.
- Create a new dated folder for any new batch (e.g., `2026-06-12/`).
- Carry forward still-open questions by **referencing** the old file, not copying it. If a question genuinely changes shape, copy + rewrite + cross-link.
- When a question is answered, edit the file's `Status:` line and the answer block at the bottom. Don't move it — keeps the dated record honest.

### Why date folders

Each meeting / async check-in surfaces a fresh batch. Dating them lets us reconstruct "what did we ask the client on X date" without losing the trail when questions get answered or rephrased. Status is tracked inline per-file, not by which folder a file lives in.
