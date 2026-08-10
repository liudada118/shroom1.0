/**
 * `@shroom/backend/collection` - 采集入库
 *
 * **零外部依赖**：数据库句柄、传感器类型、当前帧数据全部靠注入，所以这一层
 * 不绑 SQLite，也能在测试里用假 db 跑。
 *
 * 一帧到底存不存，由 `createCollectionFrameStorageService().canStore()` 回答，
 * 三个条件缺一不可、且顺序有意义：
 *
 * 1. **采集开关开着** —— 实时下发路径每帧都会调到这里，少了这条就变成
 *    「串口一有数据就落库」，没点开始采集也照写。
 * 2. 本帧没被采集频率限流（`createCollectionStorageClock()`）。
 * 3. 磁盘剩余空间够（`createCollectionDiskSpaceGuard()`），不够就急停采集。
 *
 * 真正写盘走 `createCollectionInsertQueueService()`，它把帧攒批再落库，
 * 避免高频采集时一帧一个事务。
 */
module.exports = {
  ...require('./collectionService'),
  ...require('./collectionFrameStorageService'),
  ...require('./collectionInsertQueueService'),
};
