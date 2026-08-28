/**
 * 历史维护服务。
 *
 * 目前只负责按 date 删除 matrix 历史记录；SQL 使用参数化执行，
 * 避免旧代码在 WebSocket handler 中直接拼接删除语句。
 */

/**
 * 删除单个数据库中指定日期的历史记录。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} dateLabel 历史日期标签。
 * @returns {Promise<boolean>} 是否执行了删除。
 */
function runDelete(dbRef, dateLabel) {
  return new Promise((resolve, reject) => {
    if (!dbRef || !dateLabel) {
      resolve(false);
      return;
    }

    dbRef.run('DELETE FROM matrix WHERE date = ?', [dateLabel], function onDeleted(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
  });
}

/**
 * 创建历史维护服务。
 *
 * @param {object} deps 运行时依赖。
 * @returns {{ deleteHistory: (dateLabel: string) => Promise<void> }} 历史维护 API。
 */
function createHistoryMaintenanceService({
  logger,
  getDatabases,
  isCar,
  getSensorType,
  publishSystemEvent,
}) {
  /**
   * 删除当前日期的历史记录；汽车类传感器会同时删除靠背库。
   *
   * @param {string} dateLabel 历史日期标签。
   * @returns {Promise<void>} 删除完成 Promise。
   */
  async function deleteHistory(dateLabel) {
    try {
      const { db, db1 } = getDatabases();
      await runDelete(db, dateLabel);
      if (isCar(getSensorType()) && db1) {
        await runDelete(db1, dateLabel);
      }
      publishSystemEvent({ download: 'deleteSuccess' });
    } catch (error) {
      logger?.error?.('[History] delete failed:', error);
    }
  }

  return {
    deleteHistory,
  };
}

module.exports = {
  createHistoryMaintenanceService,
  runDelete,
};
