#ifndef SHROOM_PRESSURE_FRAME_PARSER_HPP
#define SHROOM_PRESSURE_FRAME_PARSER_HPP
#include <array>
#include <cstdint>
#include <stddef.h>
#include <vector>

/** Frame 1024 pressure bytes between AA550399 tail markers with bounded pending memory. */
class ShroomPressureFrameParser {
  std::vector<uint8_t> pending_;
  bool synchronized_ = false;
public:
  /** Forget partial data when a connection ends or changes. */
  void reset() { pending_.clear(); synchronized_ = false; }
  /** Return complete frames from one input batch, retaining at most 1027 incomplete bytes. */
  std::vector<std::array<uint8_t, 1024>> accept(const uint8_t *bytes, size_t count) {
    std::vector<std::array<uint8_t, 1024>> frames;
    const uint8_t marker[4] = {0xaa, 0x55, 0x03, 0x99};
    for (size_t input = 0; input < count; ++input) {
      pending_.push_back(bytes[input]);
      const size_t size = pending_.size();
      bool tail = size >= 4;
      for (size_t index = 0; tail && index < 4; ++index) tail = pending_[size - 4 + index] == marker[index];
      if (tail) {
        if (synchronized_ && size == 1028) {
          std::array<uint8_t, 1024> frame;
          for (size_t index = 0; index < frame.size(); ++index) frame[index] = pending_[index];
          frames.push_back(frame);
        }
        pending_.clear();
        synchronized_ = true;
      } else if (size > 1027) {
        pending_.erase(pending_.begin(), pending_.end() - 3);
        synchronized_ = false;
      }
    }
    return frames;
  }
  /** Report bounded pending storage for protocol regression tests. */
  size_t pendingSize() const { return pending_.size(); }
};
#endif
