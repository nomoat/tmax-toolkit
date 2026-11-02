import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAccessControlFile } from "../lib/access-control.mjs";

const config = readAccessControlFile(
  path.join(import.meta.dirname, "..", "config", "access-control.json"),
);
assert.deepEqual(config, {
  version: 1,
  machineVisibility: "owner-only",
  superAdminEmails: ["owner@example.com"],
  machineShares: [],
  privateAccess: {
    ownerEmail: "owner@example.com",
    existingConnectors: [{ ownerEmail: "legacy@example.com", agentId: "11111111-1111-4111-8111-111111111111" }],
  },
});

const dir = mkdtempSync(path.join(os.tmpdir(), "tmux-mobile-access-control-"));
const invalid = path.join(dir, "invalid.json");
writeFileSync(
  invalid,
  JSON.stringify({
    version: 1,
    machineVisibility: "domain",
    superAdminEmails: ["owner@example.com"],
  }),
);
assert.throws(
  () => readAccessControlFile(invalid),
  /machineVisibility must be "owner-only"/,
);

const invalidShare = path.join(dir, "invalid-share.json");
writeFileSync(
  invalidShare,
  JSON.stringify({
    version: 1,
    machineVisibility: "owner-only",
    superAdminEmails: ["owner@example.com"],
    machineShares: [
      {
        ownerEmail: "owner@example.com",
        agentId: "00ef8f6b-3fce-47b0-9e4e-c7b97cbbff8c",
        domains: ["@srp.one"],
      },
    ],
  }),
);
assert.throws(
  () => readAccessControlFile(invalidShare),
  /Invalid domain.*@srp\.one/,
);

console.log("access-control unit tests passed");
