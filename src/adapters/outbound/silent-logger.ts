import type { LogFields, LoggerPort } from "../../application/ports/logger.port.js";

/** A logger that writes nothing: the default when no logger is given. */
export class SilentLogger implements LoggerPort {
  public debug(_fields: LogFields, _msg: string): void {}

  public info(_fields: LogFields, _msg: string): void {}

  public warn(_fields: LogFields, _msg: string): void {}

  public error(_fields: LogFields, _msg: string): void {}

  public child(_fields: LogFields): LoggerPort {
    return this;
  }
}
