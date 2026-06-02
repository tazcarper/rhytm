import { Card } from "@/lib/ui";
import { MarkdownProse } from "@/src/components/shared/markdown";
import type { QuestionDoc } from "@/src/services/questions/load-questions";
import { CopyButton } from "./copy-button";
import s from "./question-card.module.css";

/** Anchor / copy-target id for a single question. */
export function questionDomId(id: string): string {
  return `q-${id}`;
}

interface QuestionCardProps {
  question: QuestionDoc;
}

// One question, rendered for reading and copying. The full markdown lives in
// a `data-question-content` element so both the per-card copy button and the
// page-level "copy all" button can pull formatted content from the DOM.
export function QuestionCard({ question }: QuestionCardProps) {
  const domId = questionDomId(question.id);

  return (
    <Card elevation="soft" warm className={s.card} id={domId}>
      <div className={s.toolbar}>
        {question.status ? (
          <span className={s.status}>{question.status}</span>
        ) : (
          <span />
        )}
        <CopyButton targetId={`${domId}-content`} label="Copy question" />
      </div>
      <div id={`${domId}-content`} data-question-content>
        <MarkdownProse>{question.markdown}</MarkdownProse>
      </div>
    </Card>
  );
}
