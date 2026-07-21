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
import brandLogoIcon from '../../assets/开屏IMG/shroom-vision-logo.png';
import highPrecisionPadIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_17 (1).png';
import adaptiveSeatIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_17 (2).png';
import gripAssessmentIcon from '../../assets/开屏IMG/ChatGPT Image 2026年6月26日 13_52_18 (3).png';

const renderIcon = (src) => (
  <img alt="" className="portal-icon-img" draggable={false} src={src} />
);

export const BRAND_LOGO_SRC = brandLogoIcon;
const CAROUSEL_PAGE_SIZE = 3;

const createResearchModule = (solutionKey, index) => ({
  key: `${solutionKey}-research-${index}`,
  labelKey: 'solutions.exploring.label',
  icon: <span className="portal-research-icon" aria-hidden="true">...</span>,
  detailTitleKey: 'solutions.exploring.label',
  detailKey: 'solutions.exploring.detail',
  isResearch: true,
});

export const SOLUTIONS = [
  {
    key: 'care',
    titleKey: 'solutions.care.title',
    subtitleKey: 'solutions.care.subtitle',
    color: 'green',
    icon: renderIcon(careIcon),
    modules: [
      {
        key: 'matCol',
        labelKey: 'solutions.care.smartMattress.label',
        icon: renderIcon(bedIcon),
        detailTitleKey: 'solutions.care.smartMattress.title',
        detailKey: 'solutions.care.smartMattress.detail',
      },
      {
        key: 'petCare',
        labelKey: 'solutions.care.petCare.label',
        icon: renderIcon(petCareIcon),
        detailTitleKey: 'solutions.care.petCare.title',
        detailKey: 'solutions.care.petCare.detail',
      },
      {
        key: 'highPrecisionPad',
        labelKey: 'solutions.care.highPrecisionPad.label',
        icon: renderIcon(highPrecisionPadIcon),
        detailTitleKey: 'solutions.care.highPrecisionPad.title',
        detailKey: 'solutions.care.highPrecisionPad.detail',
      },
    ],
    detailTitleKey: 'solutions.care.detailTitle',
    detailKey: 'solutions.care.detail',
  },
  {
    key: 'vehicle',
    titleKey: 'solutions.vehicle.title',
    subtitleKey: 'solutions.vehicle.subtitle',
    color: 'blue',
    icon: renderIcon(vehicleIcon),
    modules: [
      {
        key: 'wholeChair',
        labelKey: 'solutions.vehicle.carSeat.label',
        icon: renderIcon(seatIcon),
        detailTitleKey: 'solutions.vehicle.carSeat.title',
        detailKey: 'solutions.vehicle.carSeat.detail',
      },
      {
        key: 'minzhen',
        labelKey: 'solutions.vehicle.ergonomicChair.label',
        icon: renderIcon(ergonomicChairIcon),
        detailTitleKey: 'solutions.vehicle.ergonomicChair.title',
        detailKey: 'solutions.vehicle.ergonomicChair.detail',
      },
      {
        key: 'adaptiveSeat',
        labelKey: 'solutions.vehicle.adaptiveSeat.label',
        icon: renderIcon(adaptiveSeatIcon),
        detailTitleKey: 'solutions.vehicle.adaptiveSeat.title',
        detailKey: 'solutions.vehicle.adaptiveSeat.detail',
      },
    ],
    detailTitleKey: 'solutions.vehicle.detailTitle',
    detailKey: 'solutions.vehicle.detail',
  },
  {
    key: 'embodied',
    titleKey: 'solutions.embodied.title',
    subtitleKey: 'solutions.embodied.subtitle',
    color: 'orange',
    icon: renderIcon(embodiedIcon),
    modules: [
      {
        key: 'hand0205',
        labelKey: 'solutions.embodied.glove.label',
        icon: renderIcon(gloveIcon),
        detailTitleKey: 'solutions.embodied.glove.title',
        detailKey: 'solutions.embodied.glove.detail',
      },
      {
        key: 'footVideo',
        labelKey: 'solutions.embodied.insole.label',
        icon: renderIcon(insoleIcon),
        detailTitleKey: 'solutions.embodied.insole.title',
        detailKey: 'solutions.embodied.insole.detail',
      },
      {
        key: 'robot1',
        labelKey: 'solutions.embodied.robotSkin.label',
        icon: renderIcon(robotIcon),
        detailTitleKey: 'solutions.embodied.robotSkin.title',
        detailKey: 'solutions.embodied.robotSkin.detail',
      },
    ],
    detailTitleKey: 'solutions.embodied.detailTitle',
    detailKey: 'solutions.embodied.detail',
  },
  {
    key: 'customLab',
    titleKey: 'solutions.customLab.title',
    subtitleKey: 'solutions.customLab.subtitle',
    color: 'cyan',
    icon: renderIcon(customLabIcon),
    modules: [
      {
        key: 'customLabFootPad',
        labelKey: 'solutions.customLab.footPad.label',
        icon: renderIcon(footPadIcon),
        detailTitleKey: 'solutions.customLab.footPad.title',
        detailKey: 'solutions.customLab.footPad.detail',
      },
      {
        key: 'customLabWalkway',
        labelKey: 'solutions.customLab.walkway.label',
        icon: renderIcon(walkwayIcon),
        detailTitleKey: 'solutions.customLab.walkway.title',
        detailKey: 'solutions.customLab.walkway.detail',
      },
      {
        key: 'gripAssessment',
        labelKey: 'solutions.customLab.grip.label',
        icon: renderIcon(gripAssessmentIcon),
        detailTitleKey: 'solutions.customLab.grip.title',
        detailKey: 'solutions.customLab.grip.detail',
      },
    ],
    detailTitleKey: 'solutions.customLab.detailTitle',
    detailKey: 'solutions.customLab.detail',
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
