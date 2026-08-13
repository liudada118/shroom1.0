import { describe, expect, it } from "vitest";
import {
  getSourceGridPosition,
  orientPartMatrix,
  resolveSensorPartKey,
} from "./humanBodyOrientation";

describe("人体区域方向", () => {
  it("左右手臂和左右肩读取对侧命名的数据部位", () => {
    expect(resolveSensorPartKey("右手臂")).toBe("leftArm");
    expect(resolveSensorPartKey("左手臂")).toBe("rightArm");
    expect(resolveSensorPartKey("右肩")).toBe("leftShoulder");
    expect(resolveSensorPartKey("左肩")).toBe("rightShoulder");
  });

  it("裤区继续按模型空间侧别读取对应腿部数据", () => {
    expect(resolveSensorPartKey("前裤", "negative-x")).toBe("frontPantsLeft");
    expect(resolveSensorPartKey("前裤", "positive-x")).toBe("frontPantsRight");
    expect(resolveSensorPartKey("后裤", "negative-x")).toBe("backPantsLeft");
    expect(resolveSensorPartKey("后裤", "positive-x")).toBe("backPantsRight");
  });

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

  it.each(["backPantsLeft", "backPantsRight"])("%s 的3D首尾行上下翻转", (partKey) => {
    expect(getSourceGridPosition(partKey, 1, 1, 32, 5, 8, 5)).toEqual({
      sourceRow: 7,
      sourceCol: 0,
    });
    expect(getSourceGridPosition(partKey, 32, 5, 32, 5, 8, 5)).toEqual({
      sourceRow: 0,
      sourceCol: 4,
    });
  });

  it.each(["leftArm", "rightArm", "leftShoulder", "rightShoulder"])(
    "%s 的3D行列保持原方向",
    (partKey) => {
      expect(getSourceGridPosition(partKey, 1, 1, 6, 15, 6, 7)).toEqual({
        sourceRow: 0,
        sourceCol: 0,
      });
      expect(getSourceGridPosition(partKey, 6, 15, 6, 15, 6, 7)).toEqual({
        sourceRow: 5,
        sourceCol: 6,
      });
    },
  );

  it("手臂和肩部的2D矩阵保持原始行列", () => {
    const armRows = [[1, 2], [3, 4]];
    const shoulderRows = [[5, 6], [7, 8]];

    expect(orientPartMatrix("rightArm", armRows)).toEqual(armRows);
    expect(orientPartMatrix("leftArm", armRows)).toEqual(armRows);
    expect(orientPartMatrix("rightShoulder", shoulderRows)).toEqual(shoulderRows);
    expect(orientPartMatrix("leftShoulder", shoulderRows)).toEqual(shoulderRows);
  });

  it.each(["back", "backPantsLeft", "backPantsRight"])(
    "%s 的2D矩阵上下翻转且列方向保持",
    (partKey) => {
      expect(orientPartMatrix(partKey, [[1, 2], [3, 4]])).toEqual([
        [3, 4],
        [1, 2],
      ]);
    },
  );

  it("未配置区域保持原行列方向且不修改输入", () => {
    const rows = [[1, 2], [3, 4]];

    expect(orientPartMatrix("chest", rows)).toEqual(rows);
    expect(rows).toEqual([[1, 2], [3, 4]]);
  });

  it("未知模型区域不会误读任意数据部位", () => {
    expect(resolveSensorPartKey("未知区域")).toBeUndefined();
  });

  it("右手臂不再执行旧的上下翻转", () => {
    expect(getSourceGridPosition("rightArm", 1, 1, 6, 15, 6, 7)).toEqual({
      sourceRow: 0,
      sourceCol: 0,
    });
    expect(getSourceGridPosition("rightArm", 6, 15, 6, 15, 6, 7)).toEqual({
      sourceRow: 5,
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

});
