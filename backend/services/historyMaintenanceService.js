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

function createHistoryMaintenanceService({
  logger,
  getDatabases,
  isCar,
  getSensorType,
  publishSystemEvent,
}) {
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
