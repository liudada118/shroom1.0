export const moveValue = (value) => {
    return value < 0 ? 0 : value > 580 ? 580 : value;
}

export const changePxToValue = ({value, type , length}) => {
    const maxIndex = Math.max(0, Number(length) || 0)
    let res;

    if (type === "line") {
        res = Math.floor(((value - 20) / 560) * maxIndex);
    } else {
        res = Math.floor((value / 580) * maxIndex);
    }
    return Math.max(0, Math.min(maxIndex, res));
}
