import { describe, expect, it } from "vitest";
import {
  compareMachinesByOwnerAndName,
  PRIORITY_MACHINE_OWNER_EMAIL,
  type Machine,
} from "@/tmux-mobile/types";

const machines: Machine[] = [
  { id: "z-other", hostname: "Zulu", ownerEmail: "zoe@example.com" },
  { id: "b-admin", hostname: "Beta", ownerEmail: PRIORITY_MACHINE_OWNER_EMAIL.toUpperCase() },
  { id: "a-other", hostname: "Alpha", ownerEmail: "amy@example.com" },
  { id: "a-admin", hostname: "Alpha", ownerEmail: PRIORITY_MACHINE_OWNER_EMAIL },
  { id: "b-amy", hostname: "Beta", ownerEmail: "amy@example.com" },
  { id: "unknown", hostname: "Aardvark" },
];

describe("machine ordering", () => {
  it("puts sonicgg machines first, then owners and machine names alphabetically", () => {
    expect(
      machines.slice().sort(compareMachinesByOwnerAndName).map((machine) => machine.id),
    ).toEqual(["a-admin", "b-admin", "a-other", "b-amy", "z-other", "unknown"]);
  });

  it("is stable regardless of API arrival order", () => {
    expect(
      machines.slice().reverse().sort(compareMachinesByOwnerAndName).map((machine) => machine.id),
    ).toEqual(["a-admin", "b-admin", "a-other", "b-amy", "z-other", "unknown"]);
  });
});
