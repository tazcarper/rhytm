import Link from "next/link";
import { Card, Eyebrow, Heading, PageShell, Text } from "@/lib/ui";
import { loadQuestionBatches } from "@/src/services/questions/load-questions";
import s from "./questions.module.css";

export const metadata = {
  title: "Client Questions — Rhythm Outdoors",
  description: "Open questions for the Rhythm Outdoors build, grouped by date.",
};

export default async function QuestionsIndexPage() {
  const batches = await loadQuestionBatches();

  return (
    <PageShell className={s.wideShell}>
      <header className={s.header}>
        <Eyebrow variant="crest">Client questions</Eyebrow>
        <Heading level={1}>Questions for you</Heading>
        <Text variant="lead">
          Each set below holds the open questions from a check-in. Open a set,
          copy the questions into a Word document, type your answers, and send
          the document back. Nothing here is saved automatically — your answers
          live in your document.
        </Text>
      </header>

      {batches.length === 0 ? (
        <Text>No questions yet.</Text>
      ) : (
        <div className={s.batchList}>
          {batches.map((batch) => (
            <Card
              key={batch.date}
              elevation="soft"
              hoverable
              asChild
              className={s.batchCard}
            >
              <Link href={`/questions/${batch.date}`}>
                <Eyebrow variant="muted">{batch.date}</Eyebrow>
                <Heading level={2} size="h3">
                  {batch.questions.length} question
                  {batch.questions.length === 1 ? "" : "s"}
                </Heading>
                <Text variant="caption">
                  {batch.questions
                    .slice(0, 3)
                    .map((question) => question.title.replace(/^[A-Z]\d+\s*—\s*/, ""))
                    .join(" · ")}
                  {batch.questions.length > 3 ? " · …" : ""}
                </Text>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
