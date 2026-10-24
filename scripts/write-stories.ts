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
await writeFile("data/user-stories.json", `${JSON.stringify(body, null, 2)}\n`);
console.log(`Wrote ${stories.length} stories`);
