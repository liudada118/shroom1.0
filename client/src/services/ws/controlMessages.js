const CONTROL_MESSAGE_TYPES = {
  HUNCH: '1',
  FRONT: '2',
  FLANK: '3',
  PRESS_TO_AREA: '4',
};

export const CONTROL_COMMANDS = {
  WELCOME_END: '迎宾结束',
  BACK_AIRBAG_INFLATE: '靠背气囊充气',
  SIDE_AIRBAG_INFLATE: '侧翼气囊充气',
  LEFT_SIDE_AIRBAG_INFLATE: '侧翼左侧气囊充气',
  RIGHT_SIDE_AIRBAG_INFLATE: '侧翼右侧气囊充气',
  LEFT_SIDE_AIRBAG_DEFLATE: '侧翼左侧气囊放气',
  RIGHT_SIDE_AIRBAG_DEFLATE: '侧翼右侧气囊放气',
};

export function parseControlMessage(rawMessage) {
  const message = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '');
  const type = message[0];

  if (Object.values(CONTROL_MESSAGE_TYPES).includes(type)) {
    return {
      kind: 'metric',
      type,
      value: message.split(' ')[1] ?? '',
      raw: message,
    };
  }

  const [name, backTime] = message.includes('|') ? message.split('|') : [message, undefined];
  return {
    kind: 'command',
    name,
    backTime,
    raw: message,
  };
}

export function getMetricStateUpdate(message) {
  if (message.kind !== 'metric') return null;

  switch (message.type) {
    case CONTROL_MESSAGE_TYPES.HUNCH:
      return { hunch: message.value };
    case CONTROL_MESSAGE_TYPES.FRONT:
      return { front: message.value };
    case CONTROL_MESSAGE_TYPES.FLANK:
      return { flank: message.value };
    case CONTROL_MESSAGE_TYPES.PRESS_TO_AREA:
      return { pressToArea: message.value };
    default:
      return null;
  }
}

export function getControlList(commandName, options = {}) {
  const { expandInitialBackAirbag = false, legacySideAirbag = false } = options;
  const commandParts = String(commandName).split('|');

  if (
    expandInitialBackAirbag &&
    commandName === CONTROL_COMMANDS.BACK_AIRBAG_INFLATE
  ) {
    return [
      commandName,
      CONTROL_COMMANDS.LEFT_SIDE_AIRBAG_INFLATE,
      CONTROL_COMMANDS.RIGHT_SIDE_AIRBAG_INFLATE,
    ];
  }

  if (
    legacySideAirbag &&
    (commandName === CONTROL_COMMANDS.BACK_AIRBAG_INFLATE ||
      commandParts.includes(CONTROL_COMMANDS.BACK_AIRBAG_INFLATE))
  ) {
    return [commandName, CONTROL_COMMANDS.SIDE_AIRBAG_INFLATE];
  }

  if (commandName === CONTROL_COMMANDS.LEFT_SIDE_AIRBAG_INFLATE) {
    return [commandName, CONTROL_COMMANDS.RIGHT_SIDE_AIRBAG_DEFLATE];
  }

  if (commandName === CONTROL_COMMANDS.RIGHT_SIDE_AIRBAG_INFLATE) {
    return [commandName, CONTROL_COMMANDS.LEFT_SIDE_AIRBAG_DEFLATE];
  }

  return [commandName];
}

export function sumTenByTenRows(values = []) {
  return Array.from({ length: 10 }, (_, rowIndex) => {
    let total = 0;
    for (let columnIndex = 0; columnIndex < 10; columnIndex += 1) {
      total += values[rowIndex * 10 + columnIndex] ?? 0;
    }
    return total;
  });
}

export function buildBasicControlCollectionRow(state, sitData, backData) {
  return [
    state.hunch,
    state.front,
    state.flank,
    state.dataName,
    JSON.stringify(sitData),
    JSON.stringify(backData),
  ];
}

export function buildExtendedControlCollectionRow(state, sitData, backData) {
  return [
    ...buildBasicControlCollectionRow(state, sitData, backData),
    'sit',
    ...sumTenByTenRows(sitData),
    'back',
    ...sumTenByTenRows(backData),
  ];
}
