import { logger } from '../lib/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Transport abstraction. Phase 1 ships a console transport (development) and an
 * in-memory outbox (tests). Plug in SES / Postmark / Resend here in production.
 */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const consoleTransport: MailTransport = {
  async send(message) {
    logger.info({ to: message.to, subject: message.subject }, `[mail] ${message.subject}\n${message.text}`);
  },
};

export class MemoryTransport implements MailTransport {
  readonly outbox: MailMessage[] = [];
  async send(message: MailMessage) {
    this.outbox.push(message);
  }
}

let transport: MailTransport = consoleTransport;

export function setMailTransport(next: MailTransport): void {
  transport = next;
}

export const mailService = {
  sendPasswordReset(to: string, fullName: string, resetUrl: string, ttlMinutes: number) {
    return transport.send({
      to,
      subject: 'Reset your NEXT STRIDE password',
      text: [
        `Hi ${fullName},`,
        '',
        'We received a request to reset your NEXT STRIDE password.',
        `Open this link on your phone within ${ttlMinutes} minutes to choose a new one:`,
        '',
        resetUrl,
        '',
        "If you didn't ask for this, you can ignore this email — your password won't change.",
      ].join('\n'),
    });
  },
};
