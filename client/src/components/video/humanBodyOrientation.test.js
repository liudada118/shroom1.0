import { describe, expect, it } from "vitest";
import { getSourceGridPosition, orientPartRows } from "./humanBodyOrientation";

describe("人体区域方向", () => {
  it("后背的3D首尾行上下翻转", () => {
    expect(getSourceGridPosition("back", 1, 1, 12, 10, 6, 10)).toEqual({
      sourceRow: 5,
      sourceCol: 0,
    });
    expect(getSourceGridPosition("back", 12, 10, 12, 10, 6, 10)).toEqual({
      sourceRow: 0,
      sourceCol: 9,
    });
  });

  it("右手臂的3D首尾行上下翻转", () => {
    expect(getSourceGridPosition("rightArm", 1, 1, 6, 15, 6, 7)).toEqual({
      sourceRow: 5,
      sourceCol: 0,
    });
    expect(getSourceGridPosition("rightArm", 6, 15, 6, 15, 6, 7)).toEqual({
      sourceRow: 0,
      sourceCol: 6,
    });
  });

  it("未配置区域保持原行方向", () => {
    expect(getSourceGridPosition("chest", 1, 1, 12, 10, 6, 10)).toEqual({
      sourceRow: 0,
      sourceCol: 0,
    });
    expect(getSourceGridPosition("chest", 12, 10, 12, 10, 6, 10)).toEqual({
      sourceRow: 5,
      sourceCol: 9,
    });
  });

  it("2D后背和右手臂读取相同的上下翻转规则", () => {
    expect(orientPartRows("back", [[1, 2], [3, 4]])).toEqual([[3, 4], [1, 2]]);
    expect(orientPartRows("rightArm", [[5], [6]])).toEqual([[6], [5]]);
    expect(orientPartRows("chest", [[1], [2]])).toEqual([[1], [2]]);
  });
});
