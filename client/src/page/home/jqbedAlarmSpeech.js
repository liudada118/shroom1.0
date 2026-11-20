const MERGED_ALARM_ALERTS = new Map([
  [0, null],
  [10, 'leftBed'],
  [14, 'satUp'],
]);
// 算法返回的床状态：0 离床、1 在床、3 坠床、4 坐床边；其它值（含 -1）表示这一帧没有有效结果。
const BED_STATES = new Set([0, 1, 3, 4]);
// 床状态一变成这些值就直接播报，不等对应的 merged_alarm。
const BED_STATE_ALERTS = new Map([
  [0, 'leftBed'],
  [4, 'satUp'],
]);

/**
 * 小床监测一次实时会话的语音告警状态：每个算法结果调一次 observe，返回这一帧要播的语音。
 * 缺失 / -1 的帧不结束告警；离开会话（切系统、回放、断线）时由调用方 reset。
 * ⚠️ 离床、坐床边都按床状态变化播报，不等 merged_alarm=10 / 14：算法要先满足在床时长、
 * 报警延迟才给报警，等它的话现场表现为「状态出来了也没声音」。
 * ⚠️ 已按床状态播过后，床状态再变之前不再为同一种 merged_alarm 播第二遍。
 * ⚠️ 床状态在 1 和 4 之间来回跳时每次变成 4 都会播，这里不做防抖。
 */
export function createJqbedAlarmSpeechState() {
  let previousAlarm = null;
  let previousSosPoint = null;
  let previousBedState = null;
  let announcedByState = null;

  return {
    reset() {
      previousAlarm = null;
      previousSosPoint = null;
      previousBedState = null;
      announcedByState = null;
    },
    observe({ merged_alarm: mergedAlarm, sosflag, stateInBbed } = {}) {
      let alertKey = null;
      if (Number.isInteger(stateInBbed) && BED_STATES.has(stateInBbed)) {
        if (stateInBbed !== previousBedState) {
          announcedByState = null;
          const stateKey = BED_STATE_ALERTS.get(stateInBbed);
          // 会话里第一个有效状态只记下不播：不知道之前是什么状态。
          if (stateKey && previousBedState !== null) {
            alertKey = stateKey;
            announcedByState = stateKey;
          }
        }
        previousBedState = stateInBbed;
      }

      if (Number.isInteger(mergedAlarm) && MERGED_ALARM_ALERTS.has(mergedAlarm)) {
        if (mergedAlarm !== previousAlarm) {
          const mergedKey = MERGED_ALARM_ALERTS.get(mergedAlarm);
          if (mergedKey !== announcedByState) alertKey = alertKey || mergedKey;
        }
        previousAlarm = mergedAlarm;
      }

      // 1 starts a sequence; 2..254 are continuation points, never additional alerts.
      if (Number.isInteger(sosflag) && sosflag >= 0 && sosflag <= 254) {
        if (sosflag === 1 && previousSosPoint !== 1) alertKey = 'emergency';
        previousSosPoint = sosflag;
      }
      return alertKey ? [alertKey] : [];
    },
  };
}
