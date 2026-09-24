import { builtinModules } from "node:module";
export const nodePackages = [
  ...new Set([
    ...builtinModules,
    ...builtinModules.map((name) => `${name}/*`),
    "@nestjs/*",
    "@prisma/*",
    "prisma",
    "node:*",
    "fs",
    "path",
    "crypto",
    "http",
    "https",
    "net",
    "tls",
    "child_process",
    "nodemailer",
    "pino",
  ]),
];
export const constraints = [
  {
    sourceTag: "runtime:next",
    bannedExternalImports: [
      "@nestjs/*",
      "@prisma/*",
      "prisma",
      "better-auth",
      "better-auth/adapters/*",
      "better-auth/node",
    ],
  },
  { sourceTag: "*", notDependOnLibsWithTags: ["type:app"] },
  ...["browser", "next", "react"].map((runtime) => ({
    sourceTag: `runtime:${runtime}`,
    notDependOnLibsWithTags: ["type:backend", "type:infrastructure"],
  })),
  {
    sourceTag: "runtime:browser",
    onlyDependOnLibsWithTags: [
      "runtime:browser",
      "runtime:react",
      "runtime:universal",
    ],
    bannedExternalImports: nodePackages,
  },
  {
    sourceTag: "runtime:react",
    onlyDependOnLibsWithTags: ["runtime:react", "runtime:universal"],
    bannedExternalImports: nodePackages,
  },
  {
    sourceTag: "runtime:universal",
    onlyDependOnLibsWithTags: ["runtime:universal"],
    bannedExternalImports: [
      ...nodePackages,
      "react",
      "react-dom",
      "next",
      "better-auth",
      "better-auth/*",
    ],
  },
  {
    sourceTag: "runtime:node",
    onlyDependOnLibsWithTags: ["runtime:node", "runtime:universal"],
  },
  { sourceTag: "type:ui", onlyDependOnLibsWithTags: ["type:ui", "type:util"] },
  {
    sourceTag: "type:infrastructure",
    onlyDependOnLibsWithTags: ["type:infrastructure", "type:util"],
  },
  {
    sourceTag: "type:backend",
    onlyDependOnLibsWithTags: [
      "type:backend",
      "type:infrastructure",
      "type:util",
    ],
  },
  { sourceTag: "type:util", onlyDependOnLibsWithTags: ["type:util"] },
  { sourceTag: "scope:shared", onlyDependOnLibsWithTags: ["scope:shared"] },
  ...["content", "identity", "interactions"].map((scope) => ({
    sourceTag: `scope:${scope}`,
    onlyDependOnLibsWithTags: [
      `scope:${scope}`,
      "scope:platform",
      "scope:shared",
    ],
  })),
];
