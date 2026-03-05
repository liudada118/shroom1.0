export const obj = {
  waist1: 0.15,
  waist2: 0.12,
  waist3: 0.09,
  waist4: 0.06,
  hunch1: 0.65,
  hunch2: 0.55,
  hunch3: 0.4,
  hunch4: 0.3,
  frontleg1: 0.25,
  frontleg2: 0.30,
  frontleg3: 0.35,
  frontleg4: 0.40,
  frontleg5: 0.15,
  frontleg6: 0.12,
  frontleg7: 0.09,
  frontleg8: 0.06,
  front1: 0.6,
  front2: 0.65,
  front3: 0.7,
  front4: 0.8,
};



let threshLx = {
  waistMax : 0.13,
  waistMin : 0.20,
  hunchMax : 0.60,
  hunchMin : 0.50,
  frontlegMax : 0.2,
  frontlegMin : 0.16,
  backlegMax : 0.2,
  backlegMin : 0.16,
  frontgMax : 0.2,
  frontgMin : 0.16,
}

let waistArr = [];
waistArr.push(threshLx.waistMin);
for (let i = 0; i < 2; i++) {
  waistArr.push(threshLx.waistMin + ((threshLx.waistMax - threshLx.waistMin) * (i + 1)) / 3);
}
waistArr.push(threshLx.waistMax);

let hunchArr = [];
waistArr.push(threshLx.hunchMin);
for (let i = 0; i < 2; i++) {
  hunchArr.push(threshLx.hunchMin + ((threshLx.hunchMax - threshLx.hunchMin) * (i + 1)) / 3);
}
hunchArr.push(threshLx.hunchMax);

let frontlegArr = [];
waistArr.push(threshLx.frontlegMin);
for (let i = 0; i < 2; i++) {
  frontlegArr.push(threshLx.frontlegMin + ((threshLx.frontlegMax - threshLx.frontlegMin) * (i + 1)) / 3);
}
frontlegArr.push(threshLx.frontlegMax);

let backlegArr = [];
waistArr.push(threshLx.backlegMin);
for (let i = 0; i < 2; i++) {
  backlegArr.push(threshLx.backlegMin + ((threshLx.backlegMax - threshLx.backlegMin) * (i + 1)) / 3);
}
backlegArr.push(threshLx.backlegMax);

let frontgArr = [];
waistArr.push(threshLx.frontgMin);
for (let i = 0; i < 2; i++) {
  frontgArr.push(threshLx.frontgMin + ((threshLx.frontgMax - threshLx.frontgMin) * (i + 1)) / 3);
}
frontgArr.push(threshLx.frontgMax);

export const objlx = {
  waist1: waistArr[0],
  waist2: waistArr[1],
  waist3: waistArr[2],
  waist4: waistArr[3],
  hunch1: hunchArr[0],
  hunch2: hunchArr[1],
  hunch3: hunchArr[2],
  hunch4: hunchArr[3],
  frontleg1: frontlegArr[0],
  frontleg2: frontlegArr[1],
  frontleg3: frontlegArr[2],
  frontleg4: frontlegArr[3],
  backleg1: backlegArr[0],
  backleg2: backlegArr[1],
  backleg3: backlegArr[2],
  backleg4: backlegArr[3],
  front1: frontgArr[0],
  front2: frontgArr[1],
  front3: frontgArr[2],
  front4: frontgArr[3],
};
