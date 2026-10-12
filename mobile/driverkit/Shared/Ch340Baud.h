#ifndef SHROOM_CH340_BAUD_H
#define SHROOM_CH340_BAUD_H
#include <stdint.h>

/** Calculate the CH340 UART divisor used by the actual USB control requests. */
static inline bool ShroomCH340BaudRegisters(uint32_t baud, uint16_t *register1312, uint16_t *register0f2c) {
  if (!register1312 || !register0f2c || baud < 115200 || baud > 1000000) return false;
  uint32_t divisor = 3;
  uint32_t factor;
  if (baud == 921600) { divisor = 7; factor = 0xf300; }
  else {
    factor = 1532620800U / baud;
    while (factor > 0xfff0 && divisor > 0) { factor >>= 3; --divisor; }
    if (factor > 0xfff0) return false;
    factor = 0x10000 - factor;
  }
  *register1312 = static_cast<uint16_t>((factor & 0xff00) | divisor | 0x80);
  *register0f2c = static_cast<uint16_t>(factor & 0xff);
  return true;
}
#endif
