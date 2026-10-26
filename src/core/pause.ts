export function readDeskCommand(text: string): "pause" | "resume" | null {
  const normalized = text.trim().toLowerCase().replace(/[.!]+$/g, "").replace(/\s+/g, " ");
  if (normalized === "pause wakes" || normalized === "pause oriel" || normalized === "stop waking") return "pause";
  if (normalized === "resume wakes" || normalized === "resume oriel") return "resume";
  return null;
}

export function pauseCopy(paused: boolean, already: boolean): string {
  if (paused && already) return "Wakes are already paused. Pausing does not release a hold. Nothing was sent or spent.";
  if (!paused && already) return "Wakes are already on. A wake does not approve a hold, send mail, or move money.";
  if (paused) {
    return "Wakes are paused. Saved routines stay, and Run still works. Pausing does not release a hold. A hold raised while you were away can still expire. Nothing was sent or spent.";
  }
  return "Wakes are on again. The next due routine can run, and a wake still does not approve a hold, send mail, or move money.";
}
