export type Story = {
  id: string;
  persona: string;
  role: string;
  surface: string;
  capability: string;
  title: string;
  story: string;
  acceptance: string[];
  priority: "p0" | "p1" | "p2";
  kind: "flagship" | "atlas";
  sourceInsight: string;
  testRef?: string;
};
