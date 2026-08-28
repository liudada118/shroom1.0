import { describe, expect, it } from "vitest";
import { getHumanBodyNumberViewSlots } from "./humanBodyNumberViews";

describe("human body number view slots", () => {
  it("swaps only the back-leg data sources", () => {
    expect(getHumanBodyNumberViewSlots("backLegs")).toEqual([
      { displayPartKey: "backPantsLeft", dataPartKey: "backPantsRight" },
      { displayPartKey: "backPantsRight", dataPartKey: "backPantsLeft" },
    ]);
  });

  it("normalizes string slots to matching display and data parts", () => {
    expect(getHumanBodyNumberViewSlots("leftArm")).toEqual([
      { displayPartKey: "leftShoulder", dataPartKey: "leftShoulder" },
      { displayPartKey: "leftArm", dataPartKey: "leftArm" },
    ]);
  });

  it("returns no slots for an unknown view", () => {
    expect(getHumanBodyNumberViewSlots("unknown")).toEqual([]);
  });

  it("returns fresh slot objects on every call", () => {
    const slots = getHumanBodyNumberViewSlots("chest");
    slots[0].displayPartKey = "changed";

    expect(getHumanBodyNumberViewSlots("chest")).toEqual([
      { displayPartKey: "chest", dataPartKey: "chest" },
    ]);
  });
});
