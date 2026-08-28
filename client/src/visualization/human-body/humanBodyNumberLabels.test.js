import { describe, expect, it } from "vitest";
import { HUMAN_BODY_NUMBER_PART_LABELS } from "./humanBodyNumberLabels";

describe("人体区域2D数字标题", () => {
  it("前腿数字块只交换标题", () => {
    expect(HUMAN_BODY_NUMBER_PART_LABELS.frontPantsLeft).toBe("右前腿");
    expect(HUMAN_BODY_NUMBER_PART_LABELS.frontPantsRight).toBe("左前腿");
  });

  it("后腿和右臂标题保持原语义", () => {
    expect(HUMAN_BODY_NUMBER_PART_LABELS.backPantsLeft).toBe("左后腿");
    expect(HUMAN_BODY_NUMBER_PART_LABELS.backPantsRight).toBe("右后腿");
    expect(HUMAN_BODY_NUMBER_PART_LABELS.rightArm).toBe("右手臂");
    expect(HUMAN_BODY_NUMBER_PART_LABELS.rightShoulder).toBe("右肩");
  });
});
