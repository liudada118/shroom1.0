export const DEFAULT_AGENT_SETTINGS = Object.freeze({ baseUrl: 'https://api.openai.com/v1', model: '', hasApiKey: false });
export const BUSY_TASK_STATUSES = new Set(['running', 'verifying']);
export const TOOL_LABELS = {
  get_algorithm_workspace: '读取算法工作台', analyze_algorithm_data: '分析所选采集数据', test_algorithm: '试运行算法并生成报告', prepare_algorithm_package: '准备保存分类算法',
  get_current_system: '识别本轮当前系统',
  get_algorithm_state: '读取实际算法输出',
  get_capabilities: '读取平台能力', get_current_state: '查询当前系统与设备', read_system: '读取系统配置',
  inspect_frames: '检查传感器数据', prepare_create_system: '准备新展示系统', prepare_update_display: '准备展示修改',
  prepare_duplicate_system: '准备复制展示系统',
  prepare_builtin_system: '准备内置模板系统',
  prepare_update_native_system: '准备修改独立系统', prepare_delete_native_system: '准备删除独立系统',
  prepare_connect_device: '准备连接设备', connect_device: '连接并检查设备', apply_configuration: '应用并核对配置', restore_display: '恢复展示配置',
};
export const TASK_LABELS = {
  running: '执行中', verifying: '正在核验', awaiting_action: '等待应用', succeeded: '已完成',
  failed: '执行失败', cancelled: '已停止', interrupted: '已中断', uncertain: '需要检查结果',
  pending: '待执行', applying: '正在应用', applied: '已应用', restoring: '正在恢复', restored: '已恢复',
  completed: '已完成', skipped: '已跳过',
};

/** 创建空的界面状态；真实数据只能来自桌面桥。 */
export function createAgentViewState() {
  return { snapshot: null, drafts: {}, loading: true, error: '' };
}

/** 判断任务是否仍占用执行器。 */
export function isTaskBusy(task) {
  return BUSY_TASK_STATUSES.has(task?.status) || task?.proposals?.some((proposal) => ['applying', 'restoring'].includes(proposal.status));
}

/** 汇总当前会话任务，并以最新活动任务覆盖历史快照。 */
export function collectAgentTasks(snapshot) {
  const tasks = [...(snapshot?.conversation?.tasks || [])];
  const active = snapshot?.activeTask;
  if (active && (!active.conversationId || active.conversationId === snapshot?.conversation?.id)) {
    const index = tasks.findIndex((task) => task.id === active.id);
    if (index < 0) tasks.push(active);
    else tasks[index] = active;
  }
  return tasks;
}

/** 按任务身份排列每轮消息、流式回复和执行记录；旧无身份消息按用户轮次兼容关联。 */
export function buildAgentTurns(snapshot, drafts = {}) {
  const tasks = collectAgentTasks(snapshot);
  const taskById = new Map(tasks.map((task, index) => [task.id, { task, index }]));
  const turns = [], byTask = new Map();
  let current = null, userIndex = -1;
  /** 为同一任务复用一轮，不把迟到的回复挂到下一轮。 */
  function taskTurn(id) {
    if (!byTask.has(id)) {
      const { task, index } = taskById.get(id);
      const turn = { id: `task:${id}`, task, taskIndex: index, messages: [], draft: null };
      byTask.set(id, turn); turns.push(turn);
    }
    return byTask.get(id);
  }
  for (const message of snapshot?.conversation?.messages || []) {
    if (message.role === 'user') userIndex += 1;
    const id = message.taskId || tasks[userIndex]?.id;
    if (taskById.has(id)) current = taskTurn(id);
    else {
      current = { id: `message:${message.id}`, task: null, messages: [], draft: null };
      turns.push(current);
    }
    current.messages.push(message);
  }
  for (const task of tasks) {
    const turn = taskTurn(task.id);
    const draft = drafts[task.id];
    if (draft?.conversationId === snapshot?.conversation?.id && isTaskBusy(task)
      && !turn.messages.some((message) => message.role === 'assistant')) turn.draft = draft;
  }
  return turns;
}

/** 接收权威快照和流式片段，隔离会话及已结束任务的迟到事件。 */
export function reduceAgentView(state, event) {
  if (event.type === 'runtime.error') return { ...state, loading: false, error: agentErrorMessage(event.error) };
  if (event.type === 'error') return { ...state, loading: false, error: event.message || '暂时无法连接 Agent。' };
  if (event.type === 'clearError') return { ...state, error: '' };
  if (event.type === 'state' && event.state) {
    const snapshot = event.state;
    const sameConversation = snapshot.conversation?.id === state.snapshot?.conversation?.id;
    const tasks = collectAgentTasks(snapshot);
    const drafts = sameConversation ? { ...state.drafts } : {};
    const previousMessages = state.snapshot?.conversation?.messages || [];
    for (const [taskId, draft] of Object.entries(drafts)) {
      const task = tasks.find((item) => item.id === taskId);
      const committed = (snapshot.conversation?.messages || []).some((message) => message.role === 'assistant' && (
        message.taskId === taskId || (!message.taskId && !previousMessages.some((old) => old.id === message.id && old.text === message.text))
      ));
      if (!isTaskBusy(task) || committed || draft.conversationId !== snapshot.conversation?.id) delete drafts[taskId];
    }
    return { ...state, snapshot, drafts, loading: false, error: '' };
  }
  if (event.type === 'text.delta' && typeof event.delta === 'string') {
    const snapshot = state.snapshot;
    const task = collectAgentTasks(snapshot).find((item) => item.id === event.taskId);
    const committed = snapshot?.conversation?.messages?.some((message) => message.role === 'assistant' && message.taskId === event.taskId);
    if (!isTaskBusy(task) || committed) return state;
    const existing = state.drafts[event.taskId];
    return { ...state, drafts: { ...state.drafts, [event.taskId]: {
      conversationId: snapshot.conversation?.id, text: (existing?.text || '') + event.delta,
    } } };
  }
  return state;
}

/** 将错误对象转换为可直接阅读的反馈。 */
export function agentErrorMessage(error) {
  const messages = {
    DISPLAY_SYSTEM_REVISION_CONFLICT: '配置已被其他操作修改，请读取最新配置后重新生成方案。',
    DISPLAY_SYSTEM_EXISTS: '这个系统标识已存在，请重新生成一个新系统方案。',
    DISPLAY_SYSTEM_READ_ONLY: '内置系统为只读，请创建一个新的展示系统。',
    AGENT_OPERATION_UNCERTAIN: '操作结果尚未确认，部分更改可能已生效，请先查询系统现状。',
    AGENT_CAPABILITIES_CHANGED: '可用组件或配置已变化，请重新生成方案。',
    AGENT_HTTP_UNAVAILABLE: '暂时无法连接软件服务，请检查软件运行状态。',
    AGENT_HTTP_TIMEOUT: '软件服务响应超时，请稍后查询实际状态。',
    AGENT_WS_UNAVAILABLE: '暂时无法读取实时数据通道，请检查软件运行状态。',
    AGENT_CONTRACT_UNSUPPORTED: '当前软件接口版本与 Agent 不兼容，请更新软件后重试。',
    AGENT_DEVICE_BUSY: '请先停止采集和回放，并关闭已打开或正在重连的端口。',
    AGENT_RUNTIME_CONFLICT: '当前系统已变化，请读取最新状态后重新准备连接。',
    AGENT_PORT_UNAVAILABLE: '所选串口已不可用，请检查设备连接并刷新端口列表。',
    AGENT_BINDING_UNSUPPORTED: '这个设备使用旧版专用连接方式，请使用软件现有设备控件连接。',
    AGENT_BINDING_UNAVAILABLE: '目标传感器没有唯一的通道绑定，请检查系统配置。',
    LICENSE_REQUIRED: '请先在软件中完成有效授权，再连接设备。',
    LICENSE_SCOPE_REQUIRED: '当前授权不包含这个内置传感器类型。',
    AGENT_SENSOR_TYPE_CONFLICT: '新系统的传感器标识与现有系统重复，请重新生成独立标识。',
  };
  if (messages[error?.code]) return messages[error.code];
  return typeof error === 'string' ? error : error?.message || '操作未完成，请重试。';
}

/** 预览允许用户审阅的展示配置，避免渲染模型返回的 HTML。 */
export function proposalPreview(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
