import type { OrgNode, OrgSeat } from "@/src/types/accountability";

// Pure, client-safe helpers (no server imports) so both the page and the
// client chart components can use them.

/** Assemble a flat seat list into a forest of reporting trees, sorted by sortOrder. */
export function buildOrgTree(seats: ReadonlyArray<OrgSeat>): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  seats.forEach((seat) => byId.set(seat.id, { ...seat, children: [] }));

  const roots: OrgNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const sortRecursive = (nodes: OrgNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((node) => sortRecursive(node.children));
  };
  sortRecursive(roots);
  return roots;
}

/** All descendant ids of a seat — used to keep "reports to" choices acyclic. */
export function descendantIds(seats: ReadonlyArray<OrgSeat>, rootId: string): Set<string> {
  const childrenByParent = new Map<string, OrgSeat[]>();
  seats.forEach((seat) => {
    if (!seat.parentId) return;
    const list = childrenByParent.get(seat.parentId) ?? [];
    list.push(seat);
    childrenByParent.set(seat.parentId, list);
  });

  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (!id) break;
    for (const child of childrenByParent.get(id) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

/** Free-text match across name, title, accountabilities, and email. */
export function seatMatchesQuery(seat: OrgSeat, query: string): boolean {
  if (!query) return true;
  const haystack = [seat.name ?? "", seat.title, ...seat.accountabilities, seat.email ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}
