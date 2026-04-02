/**
 * Facade de auditoria de auth: reexporta o serviço centralizado em `authEvents/`.
 */

export {
  emitAuthEvent,
  logAuthAuditEvent,
  emailDomainOnly,
} from "./authEvents/emitAuthEvent";
export type { AuthEventName } from "./authEvents/authEventNames";
export { sanitizeAuthEventPayload } from "./authEvents/sanitizeAuthEventPayload";
export type { AuthEventMeta } from "./authEvents/emitAuthEvent";
