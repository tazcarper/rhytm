import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow, Heading, PageShell, Text } from "@/lib/ui";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { CopyButton } from "@/src/components/questions/copy-button";
import { QuestionCard } from "@/src/components/questions/question-card";
import {
  loadQuestionBatch,
  loadQuestionBatches,
  type QuestionDoc,
} from "@/src/services/questions/load-questions";
import s from "../questions.module.css";

export async function generateStaticParams() {
  const batches = await loadQuestionBatches();
  return batches.map((batch) => ({ date: batch.date }));
}

interface CategoryGroup {
  category: string;
  questions: QuestionDoc[];
}

function groupByCategory(questions: QuestionDoc[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const question of questions) {
    const existing = groups.find((group) => group.category === question.category);
    if (existing) existing.questions.push(question);
    else groups.push({ category: question.category, questions: [question] });
  }
  return groups;
}

interface BatchPageProps {
  params: Promise<{ date: string }>;
}

export default async function QuestionBatchPage({ params }: BatchPageProps) {
  const { date } = await params;
  const batch = await loadQuestionBatch(date);
  if (!batch) notFound();

  const groups = groupByCategory(batch.questions);

  return (
    <PageShell className={s.wideShell}>
      <header className={s.header}>
        <Link href="/questions" className={s.backLink}>
          ← All question sets
        </Link>
        <Eyebrow variant="muted">Client questions · {batch.date}</Eyebrow>
        <Heading level={1}>Questions for {batch.date}</Heading>
        <Text variant="lead">
          Copy any question into your Word document, write your answer beneath
          it, and send the document back to us. Use “Copy all” to grab the
          whole set at once.
        </Text>
        <div className={s.actions}>
          <CopyButton
            selector="[data-question-content]"
            label={`Copy all ${batch.questions.length} questions`}
          />
        </div>
      </header>

      {groups.map((group) => (
        <section key={group.category} className={s.group}>
          <Heading level={2} size="h3" className={s.groupTitle}>
            {group.category}
          </Heading>
          <div className={s.cards}>
            {group.questions.map((question) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        </section>
      ))}

      {batch.intro ? (
        <section className={s.intro}>
          <Heading level={2} size="h4" className={s.groupTitle}>
            About this set
          </Heading>
          <MarkdownProse small>{batch.intro}</MarkdownProse>
        </section>
      ) : null}
    </PageShell>
  );
}
