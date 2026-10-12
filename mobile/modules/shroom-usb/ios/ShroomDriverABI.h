#ifndef SHROOM_DRIVER_ABI_H
#define SHROOM_DRIVER_ABI_H
#include <stdint.h>

// Keep this wire ABI identical to driverkit/Shared/ShroomDriverABI.h.
enum { ShroomConfigure = 0, ShroomRead = 1, ShroomClose = 2, ShroomMethodCount = 3 };
enum { ShroomReadCapacity = 2048, ShroomABIVersion = 1 };
typedef struct {
  uint32_t version;
  uint32_t count;
  uint8_t bytes[ShroomReadCapacity];
} ShroomReadPacket;
#endif
