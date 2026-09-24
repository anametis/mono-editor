import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const values = {
  scope: [
    "content",
    "identity",
    "interactions",
    "platform",
    "shared",
    "admin",
    "web",
  ],
  type: ["app", "backend", "infrastructure", "client", "ui", "util"],
  runtime: ["browser", "node", "universal", "react", "next"],
};
let count = 0;
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await visit(p);
    else if (entry.name === "project.json") {
      const project = JSON.parse(await readFile(p, "utf8"));
      for (const [dimension, allowed] of Object.entries(values)) {
        const tags = project.tags.filter((t) => t.startsWith(dimension + ":"));
        assert.equal(tags.length, 1, `${p}: expected one ${dimension} tag`);
        assert(
          allowed.includes(tags[0].split(":")[1]),
          `${p}: invalid ${dimension}`,
        );
      }
      assert.equal(project.tags.length, 3, `${p}: unexpected tags`);
      count++;
    }
  }
}
await visit("apps");
await visit("libs");
assert(count >= 15);
console.log(`Validated tags for ${count} projects.`);
