// CH340 register sequence adapted from usb-serial-for-android; see THIRD_PARTY_NOTICES.md.
#include <DriverKit/IOLib.h>
#include <DriverKit/IOMemoryMap.h>
#include <DriverKit/IOBufferMemoryDescriptor.h>
#include <USBDriverKit/IOUSBHostInterface.h>
#include <USBDriverKit/IOUSBHostPipe.h>
#include <USBDriverKit/IOUSBHostDevice.h>
#include <os/log.h>
#include "ShroomCH340Driver.h"
#include "ShroomCH340UserClient.h"
#include "../Shared/Ch340Baud.h"

struct ShroomCH340Driver_IVars {
  IOUSBHostInterface *interface;
  IOUSBHostPipe *input;
  IOBufferMemoryDescriptor *buffer;
  IOMemoryMap *mapping;
  bool opened;
  bool configured;
  uint32_t claimed;
};

bool ShroomCH340Driver::init(void) {
  if (!super::init()) return false;
  ivars = IONewZero(ShroomCH340Driver_IVars, 1);
  return ivars != nullptr;
}

kern_return_t ShroomCH340Driver::Start_Impl(IOService *provider) {
  kern_return_t result = Start(provider, SUPERDISPATCH);
  if (result != kIOReturnSuccess) return result;
  ivars->interface = OSDynamicCast(IOUSBHostInterface, provider);
  if (!ivars->interface) return kIOReturnBadArgument;
  ivars->interface->retain();
  result = ivars->interface->Open(this, 0, nullptr);
  if (result != kIOReturnSuccess) return result;
  ivars->opened = true;

  const IOUSBConfigurationDescriptor *configuration = ivars->interface->CopyConfigurationDescriptor();
  if (!configuration) return kIOReturnNotFound;
  const IOUSBInterfaceDescriptor *interfaceDescriptor = ivars->interface->GetInterfaceDescriptor(configuration);
  if (!interfaceDescriptor) { IOUSBHostFreeDescriptor(configuration); return kIOReturnNotFound; }
  const uint8_t *cursor = reinterpret_cast<const uint8_t *>(interfaceDescriptor) + interfaceDescriptor->bLength;
  const uint8_t *end = reinterpret_cast<const uint8_t *>(configuration) + configuration->wTotalLength;
  uint8_t inputAddress = 0;
  while (cursor + 2 <= end && cursor[0] >= 2 && cursor + cursor[0] <= end) {
    if (cursor[1] == 4) break; // The next interface does not belong to this service.
    if (cursor[1] == 5 && cursor[0] >= sizeof(IOUSBEndpointDescriptor)) {
      auto endpoint = reinterpret_cast<const IOUSBEndpointDescriptor *>(cursor);
      if ((endpoint->bmAttributes & 0x03) == 2 && (endpoint->bEndpointAddress & 0x80)) {
        inputAddress = endpoint->bEndpointAddress;
        break;
      }
    }
    cursor += cursor[0];
  }
  IOUSBHostFreeDescriptor(configuration);
  if (!inputAddress) return kIOReturnNotFound;
  result = ivars->interface->CopyPipe(inputAddress, &ivars->input);
  if (result != kIOReturnSuccess) return result;
  result = ivars->interface->CreateIOBuffer(kIOMemoryDirectionIn, ShroomReadCapacity, &ivars->buffer);
  if (result != kIOReturnSuccess) return result;
  result = ivars->buffer->CreateMapping(0, 0, 0, 0, 0, &ivars->mapping);
  if (result != kIOReturnSuccess) return result;
  os_log(OS_LOG_DEFAULT, "Shroom CH340 interface ready; waiting for signed client");
  return RegisterService();
}

kern_return_t ShroomCH340Driver::Stop_Impl(IOService *provider) {
  ivars->configured = false;
  if (ivars->opened) {
    ivars->interface->Close(this, 0);
    ivars->opened = false;
  }
  return Stop(provider, SUPERDISPATCH);
}

void ShroomCH340Driver::free(void) {
  if (ivars) {
    if (ivars->opened && ivars->interface) ivars->interface->Close(this, 0);
    OSSafeReleaseNULL(ivars->mapping);
    OSSafeReleaseNULL(ivars->buffer);
    OSSafeReleaseNULL(ivars->input);
    OSSafeReleaseNULL(ivars->interface);
    IOSafeDeleteNULL(ivars, ShroomCH340Driver_IVars, 1);
  }
  super::free();
}

kern_return_t ShroomCH340Driver::NewUserClient_Impl(uint32_t type, IOUserClient **userClient) {
  if (type != 0 || !userClient) return kIOReturnBadArgument;
  IOService *created = nullptr;
  kern_return_t result = Create(this, "UserClientProperties", &created);
  if (result != kIOReturnSuccess) return result;
  *userClient = OSDynamicCast(ShroomCH340UserClient, created);
  if (!*userClient) { created->release(); return kIOReturnError; }
  return kIOReturnSuccess;
}

kern_return_t ShroomCH340Driver::ControlOut(uint8_t request, uint16_t value, uint16_t index) {
  uint16_t count = 0;
  return ivars->interface->DeviceRequest(0x40, request, value, index, 0, nullptr, &count, 1000);
}

kern_return_t ShroomCH340Driver::ControlIn(uint8_t request, uint16_t value) {
  uint16_t count = 0;
  kern_return_t result = ivars->interface->DeviceRequest(0xc0, request, value, 0, 2, ivars->buffer, &count, 1000);
  if (result != kIOReturnSuccess) return result;
  return count == 2 ? kIOReturnSuccess : kIOReturnUnderrun;
}

kern_return_t ShroomCH340Driver::SetBaudRate(uint32_t baudRate) {
  uint16_t register1312, register0f2c;
  if (!ShroomCH340BaudRegisters(baudRate, &register1312, &register0f2c)) return kIOReturnUnsupported;
  kern_return_t result = ControlOut(0x9a, 0x1312, register1312);
  return result == kIOReturnSuccess ? ControlOut(0x9a, 0x0f2c, register0f2c) : result;
}

kern_return_t ShroomCH340Driver::Configure(uint32_t baudRate) {
  if (!ivars->opened || !ivars->input) return kIOReturnNotOpen;
  if (baudRate < 115200 || baudRate > 1000000) return kIOReturnBadArgument;
  ivars->configured = false;
  kern_return_t result;
  if ((result = ControlIn(0x5f, 0)) != kIOReturnSuccess) return result;
  if ((result = ControlOut(0xa1, 0, 0)) != kIOReturnSuccess) return result;
  if ((result = SetBaudRate(baudRate)) != kIOReturnSuccess) return result;
  if ((result = ControlIn(0x95, 0x2518)) != kIOReturnSuccess) return result;
  if ((result = ControlOut(0x9a, 0x2518, 0xc3)) != kIOReturnSuccess) return result;
  if ((result = ControlIn(0x95, 0x0706)) != kIOReturnSuccess) return result;
  if ((result = ControlOut(0xa1, 0x501f, 0xd90a)) != kIOReturnSuccess) return result;
  if ((result = SetBaudRate(baudRate)) != kIOReturnSuccess) return result;
  if ((result = ControlOut(0x9a, 0x2518, 0xc3)) != kIOReturnSuccess) return result;
  if ((result = ControlOut(0xa4, 0xff9f, 0)) != kIOReturnSuccess) return result;
  ivars->configured = true;
  return kIOReturnSuccess;
}

kern_return_t ShroomCH340Driver::Read(ShroomReadPacket *packet) {
  if (!packet || !ivars->configured) return kIOReturnNotOpen;
  memset(packet, 0, sizeof(*packet));
  packet->version = ShroomABIVersion;
  uint32_t count = 0;
  kern_return_t result = ivars->input->IO(ivars->buffer, ShroomReadCapacity, &count, 100);
  if (count > ShroomReadCapacity) return kIOReturnOverrun;
  if (result != kIOReturnSuccess && result != kIOReturnTimeout) return result;
  packet->count = count;
  if (count) memcpy(packet->bytes, reinterpret_cast<const void *>(ivars->mapping->GetAddress()), count);
  return kIOReturnSuccess;
}

void ShroomCH340Driver::CloseUART(void) { ivars->configured = false; }

kern_return_t ShroomCH340Driver::ClaimClient(void) {
  uint32_t expected = 0;
  return __atomic_compare_exchange_n(&ivars->claimed, &expected, 1, false, __ATOMIC_ACQ_REL, __ATOMIC_RELAXED)
    ? kIOReturnSuccess : kIOReturnExclusiveAccess;
}

void ShroomCH340Driver::ReleaseClient(void) {
  CloseUART();
  __atomic_store_n(&ivars->claimed, 0, __ATOMIC_RELEASE);
}
