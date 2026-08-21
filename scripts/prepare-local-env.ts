import {
  appendFileSync,
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { planLocalEnvironment } from "./lib/local-environment";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const environmentPath = path.join(repositoryRoot, ".env");
const examplePath = path.join(repositoryRoot, ".env.example");
const exists = existsSync(environmentPath);
const current = exists ? readFileSync(environmentPath, "utf8") : undefined;
const plan = planLocalEnvironment(readFileSync(examplePath, "utf8"), current);

if (plan.created) {
  writeFileSync(environmentPath, plan.content, { flag: "wx", mode: 0o600 });
  chmodSync(environmentPath, 0o600);
} else if (plan.addedKeys.length > 0) {
  appendFileSync(environmentPath, plan.appendix);
  chmodSync(environmentPath, 0o600);
}

if (plan.created) {
  process.stdout.write("Created .env from .env.example.\n");
} else if (plan.addedKeys.length > 0) {
  process.stdout.write(
    `Added missing local settings to .env: ${plan.addedKeys.join(", ")}\n`,
  );
} else {
  process.stdout.write("Preserved .env; all local settings are present.\n");
}
