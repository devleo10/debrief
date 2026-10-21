import { existsSync, readFileSync } from "node:fs";
import { validateProdEnv } from "./envCheck.mjs";

const strict =
  process.env.VERCEL_ENV === "production" ||
  process.env.REQUIRE_PROD_ENV === "1" ||
  process.argv.includes("--strict");

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

if (!strict) loadLocalEnv();

const { errors, warnings } = validateProdEnv(process.env);

for (const warning of warnings) {
  console.warn(`[check-env] warning: ${warning}`);
}

if (strict && errors.length) {
  console.error("[check-env] production build blocked:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

if (!strict) {
  for (const error of errors) {
    console.warn(`[check-env] not set: ${error}`);
  }
}

console.log(
  strict
    ? "[check-env] production environment looks complete."
    : "[check-env] environment check passed (non-production).",
);
