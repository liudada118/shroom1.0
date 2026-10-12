// DriverKit dispatch/lifecycle follows Apple's MIT-licensed user-client sample; see notices.
#include <DriverKit/IOLib.h>
#include <DriverKit/OSDictionary.h>
#include <DriverKit/OSString.h>
#include <DriverKit/OSData.h>
#include <DriverKit/IODispatchQueue.h>
#include "ShroomCH340Driver.h"
#include "ShroomCH340UserClient.h"
#include "../Shared/ShroomDriverABI.h"

#ifndef SHROOM_CLIENT_APPLICATION_ID
#define SHROOM_CLIENT_APPLICATION_ID
#endif
#define SHROOM_STRINGIFY_IMPL(value) #value
#define SHROOM_STRINGIFY(value) SHROOM_STRINGIFY_IMPL(value)
static constexpr char expectedApplicationID[] = SHROOM_STRINGIFY(SHROOM_CLIENT_APPLICATION_ID);

struct ShroomCH340UserClient_IVars { ShroomCH340Driver *driver; bool claimed; };

static const IOUserClientMethodDispatch methods[ShroomMethodCount] = {
  { .function = &ShroomCH340UserClient::Configure, .checkCompletionExists = false,
    .checkScalarInputCount = 1, .checkStructureInputSize = 0, .checkScalarOutputCount = 0, .checkStructureOutputSize = 0 },
  { .function = &ShroomCH340UserClient::Read, .checkCompletionExists = false,
    .checkScalarInputCount = 0, .checkStructureInputSize = 0, .checkScalarOutputCount = 0, .checkStructureOutputSize = sizeof(ShroomReadPacket) },
  { .function = &ShroomCH340UserClient::Close, .checkCompletionExists = false,
    .checkScalarInputCount = 0, .checkStructureInputSize = 0, .checkScalarOutputCount = 0, .checkStructureOutputSize = 0 }
};

bool ShroomCH340UserClient::init(void) {
  if (!super::init()) return false;
  ivars = IONewZero(ShroomCH340UserClient_IVars, 1);
  return ivars != nullptr;
}

kern_return_t ShroomCH340UserClient::Start_Impl(IOService *provider) {
  kern_return_t result = Start(provider, SUPERDISPATCH);
  if (result != kIOReturnSuccess) return result;
  OSDictionary *entitlements = nullptr;
  result = CopyClientEntitlements(&entitlements);
  if (result != kIOReturnSuccess || !entitlements) return kIOReturnNotPermitted;
  OSString *applicationID = OSDynamicCast(OSString, entitlements->getObject("application-identifier"));
  const bool allowed = expectedApplicationID[0] != '\0' && applicationID &&
    strcmp(applicationID->getCStringNoCopy(), expectedApplicationID) == 0;
  entitlements->release();
  if (!allowed) return kIOReturnNotPermitted;
  ivars->driver = OSDynamicCast(ShroomCH340Driver, provider);
  if (!ivars->driver) return kIOReturnBadArgument;
  ivars->driver->retain();
  IODispatchQueue *queue = nullptr;
  result = ivars->driver->CopyDispatchQueue(kIOServiceDefaultQueueName, &queue);
  if (result != kIOReturnSuccess) return result;
  result = SetDispatchQueue(kIOServiceDefaultQueueName, queue);
  queue->release();
  if (result != kIOReturnSuccess) return result;
  result = ivars->driver->ClaimClient();
  if (result != kIOReturnSuccess) return result;
  ivars->claimed = true;
  return kIOReturnSuccess;
}

kern_return_t ShroomCH340UserClient::Stop_Impl(IOService *provider) {
  if (ivars->driver && ivars->claimed) { ivars->driver->ReleaseClient(); ivars->claimed = false; }
  return Stop(provider, SUPERDISPATCH);
}

void ShroomCH340UserClient::free(void) {
  if (ivars) {
    if (ivars->driver && ivars->claimed) ivars->driver->ReleaseClient();
    OSSafeReleaseNULL(ivars->driver);
    IOSafeDeleteNULL(ivars, ShroomCH340UserClient_IVars, 1);
  }
  super::free();
}

kern_return_t ShroomCH340UserClient::ExternalMethod(uint64_t selector, IOUserClientMethodArguments *arguments,
  const IOUserClientMethodDispatch *dispatch, OSObject *target, void *reference) {
  if (!ivars->driver || selector >= ShroomMethodCount) return kIOReturnBadArgument;
  return super::ExternalMethod(selector, arguments, &methods[selector], this, nullptr);
}

kern_return_t ShroomCH340UserClient::Configure(OSObject *target, void *reference, IOUserClientMethodArguments *arguments) {
  auto client = OSDynamicCast(ShroomCH340UserClient, target);
  if (!client || !arguments || arguments->scalarInput[0] > UINT32_MAX) return kIOReturnBadArgument;
  return client->ivars->driver->Configure(static_cast<uint32_t>(arguments->scalarInput[0]));
}

kern_return_t ShroomCH340UserClient::Read(OSObject *target, void *reference, IOUserClientMethodArguments *arguments) {
  auto client = OSDynamicCast(ShroomCH340UserClient, target);
  if (!client || !arguments) return kIOReturnBadArgument;
  ShroomReadPacket packet;
  kern_return_t result = client->ivars->driver->Read(&packet);
  if (result != kIOReturnSuccess) return result;
  arguments->structureOutput = OSData::withBytes(&packet, sizeof(packet));
  return arguments->structureOutput ? kIOReturnSuccess : kIOReturnNoMemory;
}

kern_return_t ShroomCH340UserClient::Close(OSObject *target, void *reference, IOUserClientMethodArguments *arguments) {
  auto client = OSDynamicCast(ShroomCH340UserClient, target);
  if (!client) return kIOReturnBadArgument;
  client->ivars->driver->CloseUART();
  return kIOReturnSuccess;
}
