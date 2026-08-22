import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";

import { runAdminPasswordHashCommand } from "../src/operations/admin-password-hash.js";

let muted = false;
const mutedOutput = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const terminal = createInterface({
  input: process.stdin,
  output: mutedOutput,
  terminal: true,
});

async function promptSecret(label: string) {
  process.stdout.write(label);
  muted = true;
  try {
    return await terminal.question("");
  } finally {
    muted = false;
    process.stdout.write("\n");
  }
}

try {
  process.exitCode = await runAdminPasswordHashCommand({
    arguments: process.argv.slice(2),
    inputIsTTY: Boolean(process.stdin.isTTY),
    outputIsTTY: Boolean(process.stdout.isTTY),
    promptSecret,
    write(message) {
      process.stdout.write(message);
    },
  });
} finally {
  terminal.close();
}
