#import "ShroomDriverClient.h"
#import "ShroomDriverABI.h"
#include "PressureFrameParser.hpp"
#import <IOKit/IOKitLib.h>
#import <TargetConditionals.h>

@implementation ShroomDriverClient {
  io_connect_t _connection;
  ShroomPressureFrameParser _parser;
}

/// Convert IOKit failures into actionable native errors without concealing entitlement failures.
static NSError *ShroomIOError(kern_return_t status, NSString *operation) {
  return [NSError errorWithDomain:@"ShroomUSB" code:status userInfo:@{
    NSLocalizedDescriptionKey: [NSString stringWithFormat:@"%@失败（IOKit 0x%08x）。检查驱动是否已启用、USB是否已连接，以及应用/驱动的签名授权。", operation, status]
  }];
}

/// Build the public IOService matching dictionary used by Apple's iPadOS DriverKit sample.
static CFMutableDictionaryRef ShroomMatching(void) {
  return IOServiceNameMatching("ShroomCH340Driver");
}

+ (NSArray<NSDictionary *> *)listDevicesWithError:(NSError **)error {
#if TARGET_OS_SIMULATOR
  return @[];
#else
  io_iterator_t iterator = IO_OBJECT_NULL;
  kern_return_t status = IOServiceGetMatchingServices(kIOMainPortDefault, ShroomMatching(), &iterator);
  if (status != kIOReturnSuccess) {
    if (error) *error = ShroomIOError(status, @"枚举驱动");
    return nil;
  }
  NSMutableArray *devices = [NSMutableArray array];
  io_service_t service;
  while ((service = IOIteratorNext(iterator)) != IO_OBJECT_NULL) {
    uint64_t registryID = 0;
    status = IORegistryEntryGetRegistryEntryID(service, &registryID);
    if (status == kIOReturnSuccess) {
      [devices addObject:@{ @"id": [NSString stringWithFormat:@"%llu", registryID],
        @"name": @"CH340 · Shroom DriverKit", @"vendorId": @0x1a86, @"productId": @0x7523 }];
    }
    IOObjectRelease(service);
  }
  IOObjectRelease(iterator);
  return devices;
#endif
}

- (BOOL)connectWithBaudRate:(NSInteger)baudRate deviceID:(NSString *)deviceID error:(NSError **)error {
  [self disconnect];
#if TARGET_OS_SIMULATOR
  if (error) *error = [NSError errorWithDomain:@"ShroomUSB" code:1 userInfo:@{NSLocalizedDescriptionKey: @"模拟器无法接入 CH340 USB，请使用已签名并启用驱动的 M 系列 iPad。"}];
  return NO;
#else
  if (baudRate < 115200 || baudRate > 1000000) {
    if (error) *error = [NSError errorWithDomain:@"ShroomUSB" code:2 userInfo:@{NSLocalizedDescriptionKey: @"波特率须为 115200–1000000。"}];
    return NO;
  }
  io_iterator_t iterator = IO_OBJECT_NULL;
  kern_return_t status = IOServiceGetMatchingServices(kIOMainPortDefault, ShroomMatching(), &iterator);
  if (status != kIOReturnSuccess) {
    if (error) *error = ShroomIOError(status, @"查找驱动");
    return NO;
  }
  io_service_t service;
  BOOL found = NO;
  while ((service = IOIteratorNext(iterator)) != IO_OBJECT_NULL) {
    uint64_t registryID = 0;
    IORegistryEntryGetRegistryEntryID(service, &registryID);
    NSString *identifier = [NSString stringWithFormat:@"%llu", registryID];
    if (deviceID.length == 0 || [deviceID isEqualToString:identifier]) {
      found = YES;
      status = IOServiceOpen(service, mach_task_self_, 0, &_connection);
      IOObjectRelease(service);
      break;
    }
    IOObjectRelease(service);
  }
  IOObjectRelease(iterator);
  if (!found) {
    if (error) *error = [NSError errorWithDomain:@"ShroomUSB" code:3 userInfo:@{NSLocalizedDescriptionKey: @"未找到已运行的 Shroom CH340 驱动。需要嵌入驱动、正确签名，在 iPad 设置中启用驱动，并连接 USB 传感器。"}];
    return NO;
  }
  if (status != kIOReturnSuccess) {
    if (error) *error = ShroomIOError(status, @"打开驱动");
    _connection = IO_OBJECT_NULL;
    return NO;
  }
  uint64_t baud = (uint64_t)baudRate;
  status = IOConnectCallScalarMethod(_connection, ShroomConfigure, &baud, 1, NULL, NULL);
  if (status != kIOReturnSuccess) {
    if (error) *error = ShroomIOError(status, @"初始化 CH340");
    [self disconnect];
    return NO;
  }
  return YES;
#endif
}

- (NSData *)readBatchWithError:(NSError **)error {
  if (_connection == IO_OBJECT_NULL) {
    if (error) *error = ShroomIOError(kIOReturnNotOpen, @"读取未连接设备");
    return nil;
  }
  ShroomReadPacket packet = {0};
  size_t size = sizeof(packet);
  kern_return_t status = IOConnectCallStructMethod(_connection, ShroomRead, NULL, 0, &packet, &size);
  if (status != kIOReturnSuccess) {
    if (error) *error = ShroomIOError(status, @"读取 USB");
    return nil;
  }
  if (size != sizeof(packet) || packet.version != ShroomABIVersion || packet.count > ShroomReadCapacity) {
    if (error) *error = [NSError errorWithDomain:@"ShroomUSB" code:4 userInfo:@{NSLocalizedDescriptionKey: @"驱动 ABI 或返回长度不匹配，请更新应用内的配套驱动。"}];
    return nil;
  }
  return [NSData dataWithBytes:packet.bytes length:packet.count];
}

- (void)disconnect {
  _parser.reset();
  if (_connection != IO_OBJECT_NULL) {
    IOConnectCallScalarMethod(_connection, ShroomClose, NULL, 0, NULL, NULL);
    IOServiceClose(_connection);
    _connection = IO_OBJECT_NULL;
  }
}

- (NSArray<NSArray<NSNumber *> *> *)decodeBatch:(NSData *)batch {
  const auto frames = _parser.accept(static_cast<const uint8_t *>(batch.bytes), batch.length);
  NSMutableArray *output = [NSMutableArray arrayWithCapacity:frames.size()];
  for (const auto &frame : frames) {
    NSMutableArray *values = [NSMutableArray arrayWithCapacity:frame.size()];
    for (uint8_t value : frame) [values addObject:@(value)];
    [output addObject:values];
  }
  return output;
}

/// Release the Mach connection if the owning module is destroyed.
- (void)dealloc { [self disconnect]; }
@end
