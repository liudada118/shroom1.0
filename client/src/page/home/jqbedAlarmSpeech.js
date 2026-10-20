const MERGED_ALARM_ALERTS = new Map([
  [0, null],
  [10, 'leftBed'],
  [14, 'satUp'],
]);

// Keep transition state per live monitoring session. Missing/-1 frames do not end an alarm.
export function createJqbedAlarmSpeechState() {
  let previousAlarm = null;
  let previousSosPoint = null;

  return {
    reset() {
      previousAlarm = null;
      previousSosPoint = null;
    },
    observe({ merged_alarm: mergedAlarm, sosflag } = {}) {
      let alertKey = null;
      if (Number.isInteger(mergedAlarm) && MERGED_ALARM_ALERTS.has(mergedAlarm)) {
        if (mergedAlarm !== previousAlarm) alertKey = MERGED_ALARM_ALERTS.get(mergedAlarm);
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
