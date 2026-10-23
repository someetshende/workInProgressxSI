export type SeatId = "grok" | "dots" | "muse";

export type ActorId = SeatId | "oriel";

export type Intent =
  | "research"
  | "operate"
  | "code"
  | "write"
  | "personal"
  | "money"
  | "communicate"
  | "analyze"
  | "direct";

export type ApprovalKind = "send" | "pay" | "delete" | "post" | "credential";

export type ApprovalStatus = "open" | "approved" | "denied";

export type StepStatus = "done" | "waiting" | "skipped" | "denied";

export type ConnectorResult = "idle" | "live" | "fallback";

export type Connector = {
  id: SeatId;
  displayName: string;
  enabled: boolean;
  bridgeUrl: string | null;
  token: string | null;
  lastResult: ConnectorResult;
  lastError: string | null;
};

export type PublicConnector = Omit<Connector, "token"> & { hasToken: boolean };

export type Memory = {
  preferences: string[];
  people: string[];
};

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  seat: ActorId;
  status: StepStatus;
  kind?: ApprovalKind;
};

export type SeatNote = {
  seat: SeatId;
  mode: "reference" | "live";
  summary: string;
  points: string[];
  stance: string;
  liveError?: string;
};

export type Brief = {
  title: string;
  voice: string;
  synthesis: string;
  recommendation: string;
  why: string[];
  tight: boolean;
  dissent: string | null;
  seatReads: SeatNote[];
  held: ApprovalKind[];
  skipped: ApprovalKind[];
  referenceOnly: boolean;
};

export type Goal = {
  id: string;
  title: string;
  origin: string;
  text: string;
  status: "active" | "waiting" | "done";
  createdAt: string;
  updatedAt: string;
  lead: SeatId | null;
  plan: PlanStep[];
  brief: Brief;
  openLoops: string[];
  prose: string | null;
};

export type Approval = {
  id: string;
  goalId: string;
  stepId: string;
  title: string;
  detail: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  resolution: string | null;
  createdAt: string;
  settledAt: string | null;
};

export type Message = {
  id: string;
  role: "you" | "oriel";
  text: string;
  at: string;
  goalId?: string;
  approvalIds?: string[];
  tight?: boolean;
};

export type Routine = {
  id: string;
  name: string;
  instruction: string;
  createdAt: string;
  lastRunAt: string | null;
};

export type LedgerEvent = {
  id: string;
  at: string;
  goalId: string | null;
  type: string;
  detail: string;
};

export type AppState = {
  seq: number;
  memory: Memory;
  connectors: Connector[];
  goals: Goal[];
  messages: Message[];
  approvals: Approval[];
  routines: Routine[];
  events: LedgerEvent[];
};

export type Away = { title: string; lines: string[] } | null;

export type PublicState = {
  product: "Oriel";
  asOf: string;
  memory: Memory;
  connectors: PublicConnector[];
  goals: Goal[];
  messages: Message[];
  approvals: Approval[];
  routines: Routine[];
  events: LedgerEvent[];
  away: Away;
  atlas: { count: number };
  trust: string;
};

export type Deps = {
  now: () => Date;
  fetchImpl: typeof fetch;
  refine: ((synthesis: string) => Promise<string | null>) | null;
};

export type SeatChoice = {
  picked: SeatId[];
  lead: SeatId | null;
  reasons: string[];
  dropped: { id: SeatId; reason: string }[];
  intents: Intent[];
  dissent: string | null;
};

export type Policy = {
  outbound: boolean;
  payment: boolean;
  deletion: boolean;
  publicPost: boolean;
  credentials: boolean;
  businessSensitive: boolean;
  forbadeSend: boolean;
  forbadePay: boolean;
  forbadeDelete: boolean;
  forbadePost: boolean;
  preferShort: boolean;
};
