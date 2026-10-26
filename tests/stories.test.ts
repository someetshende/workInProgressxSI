import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { constraints, getCatalog, jobs, personas, queryStories } from "../src/stories/catalog.js";
import { flagshipStories } from "../src/stories/flagship.js";

describe("story atlas", () => {
  const stories = getCatalog();

  it("contains more than a thousand reviewable stories", () => {
    expect(personas).toHaveLength(18);
    expect(jobs).toHaveLength(17);
    expect(constraints).toHaveLength(102);
    expect(flagshipStories()).toHaveLength(216);
    expect(stories.length).toBe(216 + 18 * 17 * 102);
    expect(stories.length).toBeGreaterThanOrEqual(1000);
  });

  it("gives every story a unique id, title, and text", () => {
    expect(new Set(stories.map((story) => story.id)).size).toBe(stories.length);
    expect(new Set(stories.map((story) => story.title)).size).toBe(stories.length);
    expect(new Set(stories.map((story) => story.story)).size).toBe(stories.length);
  });

  it("is specific enough to review", () => {
    for (const story of stories) {
      expect(story.story.startsWith("As ")).toBe(true);
      expect(story.story).toContain("Oriel");
      expect(story.acceptance.length).toBeGreaterThanOrEqual(3);
      for (const line of story.acceptance) expect(line.length).toBeGreaterThanOrEqual(40);
      expect(story.sourceInsight.length).toBeGreaterThan(40);
      expect(["p0", "p1", "p2"]).toContain(story.priority);
    }
  });

  it("covers Grok Bot, Dots, and Muse in the source insights", () => {
    const insights = stories.map((story) => story.sourceInsight).join("\n");
    expect(insights).toContain("Grok Bot");
    expect(insights).toContain("Dots");
    expect(insights).toContain("Muse");
  });

  it("matches the committed atlas", async () => {
    const file = JSON.parse(await readFile("data/user-stories.json", "utf8")) as {
      product: string;
      count: number;
      stories: { id: string }[];
    };
    expect(file.product).toBe("Oriel");
    expect(file.count).toBe(stories.length);
    expect(JSON.stringify(file.stories)).toBe(JSON.stringify(stories));
  });

  it("searches and caps a page", () => {
    const page = queryStories("clinic administrator", 0, 5000);
    expect(page.stories.length).toBeLessThanOrEqual(100);
    expect(page.matched).toBeGreaterThan(0);
    expect(page.stories.every((story) => story.story.toLowerCase().includes("clinic administrator"))).toBe(true);
    expect(queryStories("", 0, 20).stories).toHaveLength(20);
  });
});
