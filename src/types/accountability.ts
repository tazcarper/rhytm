// Domain types for the Chart of Accountability (the company org structure).

export type OrgDivision =
  | "ownership"
  | "executive"
  | "central"
  | "media"
  | "hogheaven"
  | "horseshoebay"
  | "packsaddle";

// active = a filled seat; open = an unfilled seat; hopeful = a likely/pending hire.
export type OrgSeatStatus = "active" | "open" | "hopeful";

export interface OrgSeat {
  id: string;
  /** null/empty => an unfilled "open seat" */
  name: string | null;
  title: string;
  division: OrgDivision;
  accountabilities: ReadonlyArray<string>;
  status: OrgSeatStatus;
  email: string | null;
  phone: string | null;
  /** reporting line; null = apex (the founders) */
  parentId: string | null;
  sortOrder: number;
}

/** A seat with its direct reports resolved — the tree shape used for display. */
export interface OrgNode extends OrgSeat {
  children: OrgNode[];
}
