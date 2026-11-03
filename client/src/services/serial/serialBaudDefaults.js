const LEGACY_BAUD = Object.freeze({
  minzhen: 115200,
  handGlove115200: 115200,
  hand0507: 921600,
  hand0205: 921600,
  hand0205Single: 921600,
  hand0205Double: 921600,
  handGloveFullPacket: 921600,
  footVideo: 921600,
  fast256: 921600,
  eye: 921600,
  daliegu: 921600,
  smallSample: 921600,
  smallBed12B: 1500000,
  bed4096: 3000000,
  bed4096num: 3000000,
});

/** 旧宿主未返回默认参数时预填数字；只用于显示，不覆盖宿主的连接默认配置。 */
export function getNativeSerialBaudDefault(sourceType = '') {
  if (Object.hasOwn(LEGACY_BAUD, sourceType)) return LEGACY_BAUD[sourceType];
  return String(sourceType).includes('robot') ? 921600 : 1000000;
}
