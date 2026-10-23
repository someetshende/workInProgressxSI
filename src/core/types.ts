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

export const HANDOFF_ACTIONS = ["send", "pay", "delete", "post"] as const;

export type HandoffAction = (typeof HANDOFF_ACTIONS)[number];

export type ApprovalStatus = "open" | "approved" | "denied" | "expired";

export type StepStatus = "done" | "waiting" | "skipped" | "denied" | "expired";

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
  /** Kinds a wake left alone because the person already said not now. */
  stayed: ApprovalKind[];
  handed: boolean;
  referenceOnly: boolean;
  skill: string | null;
  rules: HandoffAction[];
  rulePhrases?: Partial<Record<HandoffAction, string>>;
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
  skillId: string | null;
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
  /** When a routine raised this hold. Null while the person is in the conversation: that hold waits. */
  expiresAt: string | null;
  settledAt: string | null;
  /** Set when a wake raised this hold, so saying not now keeps the next wake from raising the same kind. */
  routineId?: string | null;
};

export type HandoffStatus = "open" | "done" | "left";

export type Handoff = {
  id: string;
  goalId: string;
  stepId: string;
  title: string;
  detail: string;
  status: HandoffStatus;
  resolution: string | null;
  createdAt: string;
  settledAt: string | null;
};

export type HandoffRule = {
  id: string;
  action: HandoffAction;
  /** Null covers every request that would do the action. A phrase covers only a request that mentions those words. */
  phrase: string | null;
  createdAt: string;
};

export type Message = {
  id: string;
  role: "you" | "oriel";
  text: string;
  at: string;
  goalId?: string;
  approvalIds?: string[];
  tight?: boolean;
  via?: "wake";
};

export type Cadence = "manual" | "daily" | "hourly";

export type Skill = {
  id: string;
  name: string;
  method: string;
  createdAt: string;
};

export type Routine = {
  id: string;
  name: string;
  instruction: string;
  cadence: Cadence;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  /** Kinds a wake must not raise again until the person sends a message. */
  heldBack: ApprovalKind[];
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
  paused: boolean;
  memory: Memory;
  connectors: Connector[];
  goals: Goal[];
  messages: Message[];
  approvals: Approval[];
  handoffs: Handoff[];
  handoffRules: HandoffRule[];
  routines: Routine[];
  skills: Skill[];
  events: LedgerEvent[];
};

export type Away = { title: string; lines: string[] } | null;

export type PublicState = {
  product: "Oriel";
  asOf: string;
  paused: boolean;
  memory: Memory;
  connectors: PublicConnector[];
  goals: Goal[];
  messages: Message[];
  approvals: Approval[];
  handoffs: Handoff[];
  handoffRules: HandoffRule[];
  routines: Routine[];
  skills: Skill[];
  events: LedgerEvent[];
  away: Away;
  atlas: { count: number };
  trust: string;
};

export type Deps = {
  now: () => Date;
  fetchImpl: typeof fetch;
  refine: ((synthesis: string) => Promise<string | null>) | null;
  /** Test clocks only. Production uses the ten-minute unattended window. */
  holdWindowMs?: number;
  /** Set by a wake so a denied kind is not raised again until the person sends a message. */
  wakeFrom?: string;
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
  /** The person asked for the words of a message, not for it to be sent. */
  draftOnly: boolean;
  /** The person asked to forward an existing message. */
  forwardAsked: boolean;
  /** That forward is a real send: not a draft, and not ruled out. */
  forward: boolean;
  preferShort: boolean;
  handoff: boolean;
  replaces: ApprovalKind[];
  personPassword: boolean;
  personSignin: boolean;
  personCode: boolean;
};
