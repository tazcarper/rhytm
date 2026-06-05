import type { ReactNode } from "react";
import type { DevNavItem } from "../_lib/types";
import { OverviewSection } from "./overview";
import { SessionSection } from "./session";
import { CreateMemberSection } from "./create-member";
import { AddAuthorizedSection } from "./add-authorized";
import { SendInviteSection } from "./send-invite";
import { MagicLinkSection } from "./magic-link";
import { ExpireInviteSection } from "./expire-invite";
import { StampRoleSection } from "./stamp-role";
import { ResetUserSection } from "./reset-user";
import { TestAdventureSection } from "./test-adventure";
import { JunctionRowsSection } from "./junction-rows";

// Single source of truth for the dev dashboard. Every section is one entry
// here; the page renders the panels from `SECTIONS` and the sidebar nav from
// `DEV_NAV` — so adding a section is one new file + one entry here, with the
// nav staying in sync automatically (Open/Closed).

export interface DevSectionEntry extends DevNavItem {
  node: ReactNode;
}

export const SECTIONS: DevSectionEntry[] = [
  { id: "overview", label: "Overview & workflow", group: "Start here", node: <OverviewSection /> },
  { id: "session", label: "Current session", group: "Start here", node: <SessionSection /> },
  { id: "create-member", label: "Create person + membership", group: "Members", node: <CreateMemberSection /> },
  { id: "add-authorized", label: "Add household person", group: "Members", node: <AddAuthorizedSection /> },
  { id: "send-invite", label: "Send invite (email)", group: "Invites & auth", node: <SendInviteSection /> },
  { id: "magic-link", label: "Generate magic link", group: "Invites & auth", node: <MagicLinkSection /> },
  { id: "expire-invite", label: "Force-expire invite", group: "Invites & auth", node: <ExpireInviteSection /> },
  { id: "stamp-role", label: "Stamp role", group: "Invites & auth", node: <StampRoleSection /> },
  { id: "test-adventure", label: "Create test adventure", group: "Adventures", node: <TestAdventureSection /> },
  { id: "reset-user", label: "Reset test user", group: "Danger zone", node: <ResetUserSection /> },
  { id: "junction-rows", label: "Recent junction rows", group: "Inspect", node: <JunctionRowsSection /> },
];

export const DEFAULT_SECTION = "overview";

export const DEV_NAV: DevNavItem[] = SECTIONS.map(({ id, label, group }) => ({ id, label, group }));
