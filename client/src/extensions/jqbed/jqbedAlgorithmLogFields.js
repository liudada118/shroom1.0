export const JQBED_LOG_OUTPUT_FIELD_KEYS = Object.freeze([
  "body_movement_data",
  "rate",
  "stroke_risk",
  "state_in_bed",
  "onbed_ratio",
  "runtime",
  "sos_flag",
  "merged_alarm",
  "current_threshold",
  "sitting_alarm_duration_minutes",
  "on_bed_duration_minutes",
  "onbed_ratio_minute",
  "rate_minute",
  "awake_state",
  "onbed_state",
  "body_movement_flag",
  "version_info",
  "alarm_counter",
  "matrix_origin",
  "matrix_filter",
  "merged_switch",
  "filter_param",
  "sos_param",
  "sitting_area_out",
  "reserved_bytes",
  "reserved_bytes20",
  "sos_signal_out",
  "sos_coord",
]);

const knownFields = new Set(JQBED_LOG_OUTPUT_FIELD_KEYS);

export function getJqbedLogFieldInfo(key, t) {
  const prefix = knownFields.has(key)
    ? `jqbedAlgorithmConfig.log.outputFields.${key}`
    : null;
  return {
    label: t(prefix ? `${prefix}.label` : 'jqbedAlgorithmConfig.log.unknownFieldLabel'),
    description: t(prefix ? `${prefix}.description` : 'jqbedAlgorithmConfig.log.unknownFieldDescription'),
  };
}
