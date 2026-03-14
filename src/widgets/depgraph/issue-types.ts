export type DirectionType = "INWARD" | "OUTWARD" | "BOTH";
export type LinkType = string;

export interface Relation {
  direction: DirectionType;
  type: LinkType;
}

export interface CustomField {
  name: string;
  value: any;
}

export interface Relations {
  upstream: Array<Relation>;
  downstream: Array<Relation>;
}

export interface IssueLink {
  targetId: string;
  targetIdReadable: string;
  type: LinkType;
  direction: DirectionType;
  targetToSource: string;
  sourceToTarget: string;
  aggregation: boolean;
}

export interface IssuePeriod {
  presentation: string;
  minutes: number;
}

export interface SprintType {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
}

export interface IssueInfo {
  id: string;
  idReadable: string;
  isDraft: boolean;
  summary: string;
  type?: string;
  state?: string;
  sprints?: Array<SprintType>;
  assignee?: string;
  startDate: Date | null;
  dueDate: Date | null;
  estimation: IssuePeriod | null;
  resolved: boolean;
  depth: number; // Root node has depth 0.
  upstreamLinks: Array<IssueLink>;
  downstreamLinks: Array<IssueLink>;
  linksKnown: boolean;
  showUpstream: boolean;
  showDownstream: boolean;
  extraFields: Array<CustomField>;
}
