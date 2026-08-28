const NUMBER_VIEW_SLOTS = Object.freeze({
  chest: Object.freeze(["chest"]),
  back: Object.freeze(["back"]),
  leftArm: Object.freeze(["leftShoulder", "leftArm"]),
  rightArm: Object.freeze(["rightShoulder", "rightArm"]),
  frontLegs: Object.freeze(["frontPantsLeft", "frontPantsRight"]),
  backLegs: Object.freeze([
    Object.freeze({ displayPartKey: "backPantsLeft", dataPartKey: "backPantsRight" }),
    Object.freeze({ displayPartKey: "backPantsRight", dataPartKey: "backPantsLeft" }),
  ]),
});

export function getHumanBodyNumberViewSlots(viewKey) {
  const slots = NUMBER_VIEW_SLOTS[viewKey] || [];
  return slots.map((slot) => (
    typeof slot === "string"
      ? { displayPartKey: slot, dataPartKey: slot }
      : { ...slot }
  ));
}
