import { ESLint } from "eslint";
import assert from "node:assert/strict";
const eslint = new ESLint();
for (const [filePath, code] of [
  [
    "apps/admin/src/main.tsx",
    'export { Database } from "@kara/platform-database";',
  ],
  [
    "apps/web/src/app/page.tsx",
    'export { ContentService } from "@kara/content-server";',
  ],
  [
    "libs/shared/ui/src/index.tsx",
    'export { apiClient } from "@kara/api-client";',
  ],
  ["libs/shared/permissions/src/index.ts", 'export { useState } from "react";'],
  ["apps/admin/src/main.tsx", 'export { readFile } from "node:fs";'],
]) {
  const results = await eslint.lintText(code, { filePath });
  assert(
    results.some((r) =>
      r.messages.some((m) =>
        ["@nx/enforce-module-boundaries", "no-restricted-imports"].includes(
          m.ruleId,
        ),
      ),
    ),
    `Forbidden dependency was accepted: ${filePath} ${code}`,
  );
}
console.log(
  "PASS architecture: backend imports, UI clients, React in universal code, and browser Node imports are rejected",
);
