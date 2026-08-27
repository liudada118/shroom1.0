const createSlot = (slotKey, displayPartKey, dataPartKey = displayPartKey) => Object.freeze({
  slotKey,
  displayPartKey,
  dataPartKey,
})

const createView = (key, titleKey, upperSlots, lowerSlots) => Object.freeze({
  key,
  titleKey,
  upperSlots: Object.freeze(upperSlots),
  lowerSlots: Object.freeze(lowerSlots),
})

export const HUMAN_BODY_RAW_VIEWS = Object.freeze([
  createView(
    'front',
    'humanBodyRaw.frontView',
    [
      createSlot('front-left-arm', 'leftArm'),
      createSlot('front-left-shoulder', 'leftShoulder'),
      createSlot('front-chest', 'chest'),
      createSlot('front-right-shoulder', 'rightShoulder'),
      createSlot('front-right-arm', 'rightArm'),
    ],
    [
      createSlot('front-left-leg', 'frontPantsRight'),
      createSlot('front-right-leg', 'frontPantsLeft'),
    ],
  ),
  createView(
    'back',
    'humanBodyRaw.backView',
    [
      createSlot('back-torso', 'back'),
    ],
    [
      createSlot('back-left-leg', 'backPantsLeft', 'backPantsRight'),
      createSlot('back-right-leg', 'backPantsRight', 'backPantsLeft'),
    ],
  ),
])

export const HUMAN_BODY_RAW_SLOTS = Object.freeze(
  HUMAN_BODY_RAW_VIEWS.flatMap((view) => [...view.upperSlots, ...view.lowerSlots]),
)

export const HUMAN_BODY_RAW_DATA_PART_KEYS = Object.freeze(
  HUMAN_BODY_RAW_SLOTS.map((slot) => slot.dataPartKey),
)
