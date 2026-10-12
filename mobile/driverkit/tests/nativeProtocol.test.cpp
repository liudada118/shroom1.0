#include <cassert>
#include <iostream>
#include <vector>
#include "../../modules/shroom-usb/ios/PressureFrameParser.hpp"
#include "../Shared/Ch340Baud.h"
#include "../Shared/ShroomDriverABI.h"

/** Exercise the production native framer and UART divisor with no Apple SDK dependencies. */
int main() {
  ShroomPressureFrameParser parser;
  const uint8_t marker[] = {0xaa, 0x55, 0x03, 0x99};
  std::vector<uint8_t> stream(marker, marker + 4);
  for (unsigned index = 0; index < 1024; ++index) stream.push_back(index % 256);
  stream.insert(stream.end(), marker, marker + 4);
  for (size_t split = 1; split < stream.size(); ++split) {
    parser.reset();
    auto first = parser.accept(stream.data(), split);
    auto second = parser.accept(stream.data() + split, stream.size() - split);
    assert(first.size() + second.size() == 1);
    const auto &frame = first.empty() ? second.front() : first.front();
    for (unsigned index = 0; index < 1024; ++index) assert(frame[index] == index % 256);
  }
  parser.reset();
  std::vector<uint8_t> noise(100000, 0x42);
  assert(parser.accept(noise.data(), noise.size()).empty());
  assert(parser.pendingSize() <= 1027);
  assert(parser.accept(stream.data(), stream.size()).size() == 1);
  parser.reset();
  assert(parser.accept(stream.data() + 4, stream.size() - 4).empty()); // Partial startup is not a frame.
  std::vector<uint8_t> malformed(marker, marker + 4);
  malformed.insert(malformed.end(), 1023, 0x11);
  malformed.insert(malformed.end(), marker, marker + 4);
  assert(parser.accept(malformed.data(), malformed.size()).empty());
  uint16_t reg1 = 0, reg2 = 0;
  assert(ShroomCH340BaudRegisters(1000000, &reg1, &reg2) && reg1 == 0xfa83 && reg2 == 0x04);
  assert(ShroomCH340BaudRegisters(921600, &reg1, &reg2) && reg1 == 0xf387 && reg2 == 0x00);
  assert(ShroomCH340BaudRegisters(115200, &reg1, &reg2) && reg1 == 0xcc83 && reg2 == 0x08);
  assert(!ShroomCH340BaudRegisters(0, &reg1, &reg2));
  assert(!ShroomCH340BaudRegisters(2000000, &reg1, &reg2));
  static_assert(sizeof(ShroomReadPacket) == 2056, "UserClient ABI must remain bounded and stable");
  std::cout << "Native framer split points, recovery, memory bound, and CH340 baud tests passed\n";
}
