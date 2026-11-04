import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { PrototypeShell } from "@/src/components/admin/prototypes/prototype-shell";
import { OneQuestionFlow } from "@/src/components/admin/prototypes/one-question-flow";
import { OnePageFlow } from "@/src/components/admin/prototypes/one-page-flow";
import { ChatFlow } from "@/src/components/admin/prototypes/chat-flow";
import { OnThePageFlow } from "@/src/components/admin/prototypes/on-the-page-flow";
import {
  EVENT_PROTOTYPES,
  isEventPrototypeSlug,
  type EventPrototypeSlug,
} from "@/src/constants/admin/event-prototypes";

const FLOWS: Record<EventPrototypeSlug, ComponentType> = {
  "one-question": OneQuestionFlow,
  "one-page": OnePageFlow,
  chat: ChatFlow,
  "on-the-page": OnThePageFlow,
};

export default async function EventPrototypePage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!isEventPrototypeSlug(flow)) notFound();
  const Flow = FLOWS[flow];
  const title = EVENT_PROTOTYPES.find((prototype) => prototype.slug === flow)?.title ?? "Prototype";

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Prototypes", href: "/admin/events/prototypes" },
          { label: title },
        ]}
      />
      <PrototypeShell slug={flow}>
        <Flow />
      </PrototypeShell>
    </PageShell>
  );
}
