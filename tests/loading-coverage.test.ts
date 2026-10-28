import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function pageDirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pageDirectories(join(path, entry.name))
      : entry.name === "page.tsx"
        ? [path]
        : [],
  );
}
describe("route loading coverage", () => {
  it("gives every page an explicit layout-matched loading boundary", () => {
    for (const directory of pageDirectories("app"))
      expect(existsSync(join(directory, "loading.tsx")), directory).toBe(true);
  });
  it("keeps async admin and account layout authentication inside Suspense", () => {
    for (const name of ["admin", "account"])
      expect(readFileSync(`app/${name}/layout.tsx`, "utf8")).toContain(
        "<Suspense fallback=",
      );
  });
});
