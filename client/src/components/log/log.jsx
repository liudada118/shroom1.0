import React from 'react';
import { useTranslation } from 'react-i18next';

const renew = {
  xy0407: [
    'legacyLog.sensorLineOrder',
    'legacyLog.rotationMatrixBug',
    'legacyLog.matrixReset',
    'legacyLog.playbackOptimization',
    'legacyLog.cancelBoxSelection',
    'legacyLog.chartDisplay',
  ],
  xy0410: ['legacyLog.redPoint'],
  'XY0510 beta1.0': ['legacyLog.airbagControl'],
  XY0516: ['legacyLog.airbagAlgorithm'],
  XY0601: ['legacyLog.divideBy8Legacy'],
  XY06016: ['legacyLog.divideBy6Legacy'],
  JQ0603: ['legacyLog.vehicleSeatChart'],
  XY0603: ['legacyLog.realtimeSleepPosture'],
  JQ0604: ['legacyLog.jqbedOnly'],
  CAR0611: ['legacyLog.colors', 'legacyLog.pressureDivision', 'legacyLog.threeDFixes', 'legacyLog.zeroing'],
  CAR0614: ['legacyLog.volvoHeadZero'],
  CAR0616: ['legacyLog.localization', 'legacyLog.zeroDownloadSync', 'legacyLog.headrestPlaybackDownload'],
  SHOW0616: ['legacyLog.footBug', 'legacyLog.handSensorWiringNotes'],
  JQ0621end: ['legacyLog.terminalMattressCollection'],
  JQ0625: ['legacyLog.handOutputSmallBedOrder'],
  JQ829: ['legacyLog.executableWiringEncryption'],
  JQ912: ['legacyLog.nodeVehicleSensorOrder', 'legacyLog.rawDataOrder'],
  JQ919: ['legacyLog.keyNetworkTime'],
  JQ920: ['legacyLog.heatmap2d'],
  'JQ-BED-240929': ['legacyLog.areaPointTimesEight'],
  'JQ-HAND-241007': ['legacyLog.handOutputSensor'],
  'JQ-HAND-241018': ['legacyLog.onlineTimestampLocalServer'],
  'JQ-BED-241104': ['legacyLog.removePressureDivision'],
  'JQTOOLS-241128': ['legacyLog.keyTypeTime', 'legacyLog.hipSensor', 'legacyLog.mattressInitial'],
  'JQTOOLS-250110': ['legacyLog.gloveSensor', 'legacyLog.xiyueNoDivision'],
  'JQTOOLS-LRhand': ['legacyLog.leftRightHand'],
  '0609_4096': ['legacyLog.version4096'],
  '0612Car': ['legacyLog.endiVehicle'],
  '0703QX': ['legacyLog.qingxianSeat'],
  '0718QX': ['legacyLog.qingxianSeat'],
  '0728_100': ['100HZ256'],
  '0805': ['legacyLog.eyeMask'],
  '26_1_20': ['legacyLog.pressureTwoDecimals'],
  '26_1_20_1': ['legacyLog.rift1420'],
  '26_2_5': ['legacyLog.matrixZoom'],
};

export default function Log() {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '30px' }}>
      {Object.keys(renew).reverse().map((version) => (
        <section key={version}>
          <h2>{version}</h2>
          <ul>
            {renew[version].map((changeKey) => (
              <li key={`${version}-${changeKey}`}>{changeKey.startsWith('legacyLog.') ? t(changeKey) : changeKey}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
