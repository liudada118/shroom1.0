class CommandRouter {
  constructor({ logger } = {}) {
    this.logger = logger || console;
    this.handlers = new Map();
  }

  register(type, handler) {
    if (!type || typeof handler !== 'function') {
      throw new Error('CommandRouter.register requires a command type and handler');
    }
    this.handlers.set(type, handler);
    return this;
  }

  has(type) {
    return this.handlers.has(type);
  }

  dispatch(command = {}) {
    const type = command.type || command.action;
    if (!type) {
      this.logger.warn?.('[CommandRouter] command missing type/action', command);
      return null;
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      this.logger.warn?.('[CommandRouter] unsupported command', { type });
      return null;
    }

    return handler(command);
  }
}

module.exports = {
  CommandRouter,
};
