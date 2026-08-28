/**
 * 展示方案用户偏好的本机持久化。
 *
 * 键名沿用引入画布配置之前就在用的 `display-profile:<displaySystemId>`，
 * 不新开存储键；`selection.canvas` 只是这份偏好里多出来的一个字段。
 *
 * 单独抽成模块是因为主界面 `Home` 是 class 组件用不了 hook，而
 * `ManifestDisplayRenderer` 是函数组件 —— 两边共用同一段读写逻辑，
 * 避免哪天键名或容错行为只改了一处。
 */

const STORAGE_PREFIX = 'display-profile:';

/**
 * 拼出某个展示系统的偏好键。
 *
 * @param {string} displaySystemId 展示系统 id。
 * @returns {string} localStorage 键名。
 */
export function displaySelectionStorageKey(displaySystemId) {
  return `${STORAGE_PREFIX}${displaySystemId || 'unknown'}`;
}

/**
 * 读取偏好。存储不可用或内容坏掉时一律返回空对象，
 * 让上层按 manifest 默认值渲染而不是抛错。
 *
 * @param {string} displaySystemId 展示系统 id。
 * @returns {object} 偏好对象。
 */
export function readDisplaySelection(displaySystemId) {
  try {
    return JSON.parse(localStorage.getItem(displaySelectionStorageKey(displaySystemId))) || {};
  } catch {
    return {};
  }
}

/**
 * 写入偏好。写失败不影响本次会话内已生效的选择。
 *
 * @param {string} displaySystemId 展示系统 id。
 * @param {object} selection 偏好对象。
 * @returns {void}
 */
export function writeDisplaySelection(displaySystemId, selection) {
  try {
    localStorage.setItem(
      displaySelectionStorageKey(displaySystemId),
      JSON.stringify(selection),
    );
  } catch {
    // 存储不可用时只丢持久化，不影响当前会话。
  }
}
