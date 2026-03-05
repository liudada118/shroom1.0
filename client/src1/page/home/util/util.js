import { smoothClass } from "../../../../src/assets/util/util";

const sitSmooth = new smoothClass(5);

export function calSelectArr(param) {
    const selectArr = [];
    const { selectIndexArr, matrixArrData, matrixWidth, pointToAreaProp, smoothValue } = param;
    for (let i = selectIndexArr[0]; i <= selectIndexArr[1]; i++) {
        for (let j = selectIndexArr[2]; j <= selectIndexArr[3]; j++) {
            selectArr.push(matrixArrData[i * matrixWidth + j]);
        }
    }
    let DataArr;
    if (selectIndexArr.every((a) => a == 0)) {
        DataArr = [...wsPointData];
    } else {
        DataArr = [...selectArr];
    }

    const point = DataArr.filter((a) => a > 0).length;
    const max = findMax(DataArr);
    const total = DataArr.reduce((a, b) => a + b, 0);
    const mean = total / (point ? point : 1);
    const area = point * pointToAreaProp

    return {
        point , max , total , mean , area , DataArr
    }
}