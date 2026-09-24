import { build } from "esbuild";
import { transform } from "@swc/core";
import { readFile } from "node:fs/promises";
export async function compile(entry, outfile) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: true,
    tsconfig: "tsconfig.base.json",
    plugins: [
      {
        name: "nest-metadata",
        setup(b) {
          b.onLoad({ filter: /\.ts$/ }, async ({ path }) => ({
            contents: (
              await transform(await readFile(path, "utf8"), {
                filename: path,
                jsc: {
                  parser: { syntax: "typescript", decorators: true },
                  transform: { legacyDecorator: true, decoratorMetadata: true },
                  target: "es2022",
                },
                module: { type: "es6" },
              })
            ).code,
            loader: "js",
          }));
        },
      },
    ],
  });
}
if (process.argv[1]?.endsWith("/compile.mjs"))
  await compile(process.argv[2], process.argv[3]);
