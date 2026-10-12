#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
/** Access the registered Shroom DriverKit service; this does not use a tty device. */
@interface ShroomDriverClient : NSObject
/// Enumerate running Shroom drivers, which appear only after driver activation and USB attachment.
+ (nullable NSArray<NSDictionary *> *)listDevicesWithError:(NSError **)error;
/// Open the selected driver and configure its CH340 UART; reject missing drivers and entitlements.
- (BOOL)connectWithBaudRate:(NSInteger)baudRate deviceID:(nullable NSString *)deviceID error:(NSError **)error;
/// Read one bounded USB batch; a USB timeout returns empty data, while removal returns an error.
- (nullable NSData *)readBatchWithError:(NSError **)error;
/// Frame one raw batch using the portable, bounded native protocol decoder.
- (NSArray<NSArray<NSNumber *> *> *)decodeBatch:(NSData *)batch;
/// Close the current user client; callers serialize this with reads on a private queue.
- (void)disconnect;
@end
NS_ASSUME_NONNULL_END
