export const moveValue = (value) => {
    return value < 0 ? 0 : value > 580 ? 580 : value;
}

export const changePxToValue = ({value, type , length}) => {
    let res;

    if (type === "line") {
        res = Math.floor(((value - 20) / 560) * (length - 1));
    } else {
        res = Math.floor((value / 580) * (length - 1));
    }
    return res;
}