import React from 'react';
import careIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_00 (1).png';
import vehicleIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_01 (2).png';
import embodiedIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_01 (3).png';
import bedIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_01 (4).png';
import seatIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_03 (6).png';
import gloveIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_04 (8).png';
import insoleIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_04 (9).png';
import robotIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 16_08_04 (10).png';
import ergonomicChairIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 19_12_02.png';
import petCareIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 19_14_02.png';
import customLabIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 21_52_37 (1).png';
import footPadIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 21_52_37 (2).png';
import walkwayIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 21_52_38 (3).png';
import brandLogoIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月25日 21_52_51.png';
import highPrecisionPadIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_17 (1).png';
import adaptiveSeatIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_17 (2).png';
import gripAssessmentIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_18 (3).png';

const renderIcon = (src, alt) => (
  <img alt={alt} className="solution-icon-img" draggable={false} src={src} />
);

export const BRAND_LOGO_SRC = brandLogoIcon;
const CAROUSEL_PAGE_SIZE = 3;

const createResearchModule = (solutionKey, index) => ({
  key: `${solutionKey}-research-${index}`,
  label: '正在探索',
  icon: <span className="solution-research-icon" aria-hidden="true">...</span>,
  detailTitle: '正在探索',
  detail: '更多定制方向正在探索中。',
  isResearch: true,
});

export const SOLUTIONS = [
  {
    key: 'care',
    title: '康养解决方案',
    subtitle: '聚焦健康管理与智慧养老场景',
    color: 'green',
    icon: renderIcon(careIcon, '康养解决方案'),
    modules: [
      {
        key: 'matCol',
        label: '智能床垫',
        icon: renderIcon(bedIcon, '智能床垫'),
        detailTitle: '智能床垫方案',
        detail: '实时监测心率、呼吸、在离床等数据，与异常预警。',
      },
      {
        key: 'petCare',
        label: '宠物检测',
        icon: renderIcon(petCareIcon, '宠物检测'),
        detailTitle: '宠物检测方案',
        detail: '采集宠物在垫状态、呼吸、姿态与体动数据，支持宠物健康监测和异常提醒。',
      },
      {
        key: 'highPrecisionPad',
        label: '高精密小垫',
        icon: renderIcon(highPrecisionPadIcon, '高精密小垫'),
        detailTitle: '高精密小垫方案',
        detail: '传感点密集精准，可实现局部高分辨率压力感知与精细化分析。',
      },
    ],
    detailTitle: '智能床方案',
    detail:
      '实时监测心率、呼吸、在离床等数据，与异常预警。',
  },
  {
    key: 'vehicle',
    title: '座椅定制方案',
    subtitle: '覆盖汽车座椅与人体工学椅场景',
    color: 'blue',
    icon: renderIcon(vehicleIcon, '座椅定制方案'),
    modules: [
      {
        key: 'wholeChair',
        label: '汽车座椅',
        icon: renderIcon(seatIcon, '汽车座椅'),
        detailTitle: '汽车座椅方案',
        detail: '采集乘坐压力分布数据，优化座椅舒适性与安全性。',
      },
      {
        key: 'minzhen',
        label: '人体工学椅',
        icon: renderIcon(ergonomicChairIcon, '人体工学椅'),
        detailTitle: '人体工学椅方案',
        detail: '采集坐姿、支撑区域与压力分布数据，辅助人体工学椅舒适性验证与结构优化。',
      },
      {
        key: 'adaptiveSeat',
        label: '自适应座椅',
        icon: renderIcon(adaptiveSeatIcon, '自适应座椅'),
        detailTitle: '自适应座椅系统',
        detail: '根据人体体位与压力分布，智能调节座椅支撑与按摩功能。',
      },
    ],
    detailTitle: '汽车座椅方案',
    detail:
      '采集乘坐姿态与压力分布数据，优化座椅舒适性与安全性。',
  },
  {
    key: 'embodied',
    title: '具身智能方案',
    subtitle: '面向机器人与智能硬件场景',
    color: 'orange',
    icon: renderIcon(embodiedIcon, '具身智能方案'),
    modules: [
      {
        key: 'hand0205',
        label: '触觉手套',
        icon: renderIcon(gloveIcon, '触觉手套'),
        detailTitle: '触觉手套方案',
        detail: '多点触觉感知与力反馈，支持精细操作。',
      },
      {
        key: 'footVideo',
        label: '智能鞋垫',
        icon: renderIcon(insoleIcon, '智能鞋垫'),
        detailTitle: '智能鞋垫方案',
        detail: '记录足底压力与步态变化，支持运动分析、康复评估和穿戴设备验证。',
      },
      {
        key: 'robot1',
        label: '机器人皮肤',
        icon: renderIcon(robotIcon, '机器人'),
        detailTitle: '机器人方案',
        detail: '面向机器人触觉感知与硬件联动，支持接触识别和精细控制。',
      },
    ],
    detailTitle: '触觉手套方案',
    detail:
      '多点触觉感知与力反馈，支持人机交互与精细操作。',
  },
  {
    key: 'customLab',
    title: '定制LAB',
    subtitle: '面向定制需求与方案创新探索',
    color: 'cyan',
    icon: renderIcon(customLabIcon, '定制LAB'),
    modules: [
      {
        key: 'customLabFootPad',
        label: '智能足垫',
        icon: renderIcon(footPadIcon, '智能足垫'),
        detailTitle: '智能足垫方案',
        detail: '采集足底压力分布，生成分析报告，辅助步态与健康评估。',
      },
      {
        key: 'customLabWalkway',
        label: '智能步道',
        icon: renderIcon(walkwayIcon, '智能步道'),
        detailTitle: '智能步道方案',
        detail: '面向步道压力采集、步态分析与原型验证。',
      },
      {
        key: 'gripAssessment',
        label: '握力评估',
        icon: renderIcon(gripAssessmentIcon, '握力评估'),
        detailTitle: '握力评估系统',
        detail: '精准判断每次握力状态，辅助评估老年人肌力水平与身体机能。',
      },
    ],
    detailTitle: '智能足垫方案',
    detail:
      '采集足垫压力分布数据，输出一份精准的足垫压力分布报告。。',
  },
];

const ALL_SOLUTION_SENSOR_KEYS = SOLUTIONS.flatMap((solution) =>
  solution.modules.map((module) => module.key)
);

export const getSolutionCarouselSlides = (solution) => {
  const modules = [...solution.modules];
  while (modules.length < CAROUSEL_PAGE_SIZE || modules.length % CAROUSEL_PAGE_SIZE !== 0) {
    modules.push(createResearchModule(solution.key, modules.length));
  }

  const slides = [];
  for (let index = 0; index < modules.length; index += CAROUSEL_PAGE_SIZE) {
    slides.push(modules.slice(index, index + CAROUSEL_PAGE_SIZE));
  }
  return slides;
};

export const normalizeLicenseFiles = (file) => {
  if (file === 'all') return ALL_SOLUTION_SENSOR_KEYS;
  if (Array.isArray(file)) return file;
  return file ? [file] : [];
};

export const getUnlockedSolutions = (files) => {
  if (!files.length) return [];
  return SOLUTIONS
    .filter((solution) =>
      solution.modules.some((module) => files.includes(module.key))
    )
    .map((solution) => solution.key);
};
