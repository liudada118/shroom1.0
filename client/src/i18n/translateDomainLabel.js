const domainLabelKeys = Object.freeze({
  '标签': 'domainLabels.defaultLabel',
  '座椅': 'sit',
  '靠背': 'back',
  '正常': 'domainLabels.normal',
  '脊柱侧弯': 'domainLabels.scoliosis',
  '前倾': 'domainLabels.forwardLean',
  '驼背': 'domainLabels.hunchback',
  '二郎腿': 'domainLabels.crossedLegs',
  '其他': 'domainLabels.other',
  '平躺': 'domainLabels.supine',
  '侧睡': 'domainLabels.sideSleep',
  '趴睡': 'domainLabels.prone',
  '侧躺': 'domainLabels.sideLying',
  '左侧躺': 'domainLabels.leftSideLying',
  '右侧躺': 'domainLabels.rightSideLying',
  '高足弓': 'footAnalysis.highArch',
  '扁平足': 'footAnalysis.flat',
  '座椅向前': 'home.seatControls.seatForward',
  '靠背向后': 'home.seatControls.backrestBackward',
  '靠背向前': 'home.seatControls.backrestForward',
  '靠背气囊充气': 'home.seatControls.backrestInflate',
  '靠背气囊放气': 'home.seatControls.backrestDeflate',
  '坐垫向下移动': 'home.seatControls.cushionDown',
  '腿部气囊放气': 'home.seatControls.legDeflate',
  '坐垫向上移动': 'home.seatControls.cushionUp',
  '腿部气囊充气': 'home.seatControls.legInflate',
  '侧翼右侧气囊充气': 'home.seatControls.rightBolsterInflate',
  '侧翼左侧气囊充气': 'home.seatControls.leftBolsterInflate',
  '侧翼右侧气囊放气': 'home.seatControls.rightBolsterDeflate',
  '侧翼左侧气囊放气': 'home.seatControls.leftBolsterDeflate',
});

export const translateDomainLabel = (value, t) => {
  if (typeof value !== 'string') return value;

  const suffixMatch = value.match(/^(.*?)(_\d+)$/);
  const baseValue = suffixMatch ? suffixMatch[1] : value;
  const suffix = suffixMatch ? suffixMatch[2] : '';
  const key = domainLabelKeys[baseValue];

  return key ? `${t(key)}${suffix}` : value;
};
