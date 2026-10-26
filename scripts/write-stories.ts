import { mkdir, writeFile } from "node:fs/promises";
import { AS_OF } from "../src/core/doctrine.js";
import { getCatalog } from "../src/stories/catalog.js";

const stories = getCatalog();
const body = {
  product: "Oriel",
  asOf: AS_OF,
  count: stories.length,
  flagship: stories.filter((story) => story.kind === "flagship").length,
  atlas: stories.filter((story) => story.kind === "atlas").length,
  about:
    "Flagship stories are the executable spec. Atlas stories expand every persona, job, and constraint into a reviewable requirement. Oriel is the window. Grok Bot, Dots, and Muse stay themselves.",
  stories,
};

await mkdir("data", { recursive: true });
const limit = 104_857_600;
const pretty = `${JSON.stringify(body, null, 2)}\n`;
const compact = `${JSON.stringify(body)}\n`;
const chosen = Buffer.byteLength(pretty) < limit ? pretty : compact;
const bytes = Buffer.byteLength(chosen);
if (bytes >= limit) {
  console.error(`atlas is ${bytes} bytes, over the ${limit} byte GitHub limit`);
  process.exit(1);
}
await writeFile("data/user-stories.json", chosen);
console.log(`Wrote ${stories.length} stories (${bytes} bytes, ${chosen === pretty ? "pretty" : "compact"})`);
