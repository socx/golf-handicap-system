import https from 'node:https';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

export type EmailProvider = 'mailpit' | 'smtp' | 'sendgrid' | 'ses' | 'mock';
export type TemplateName = 'password_reset' | 'account_activation' | 'handicap_update' | 'round_update';

export interface EmailBody {
  text: string;
  html?: string;
}

export type EmailBodyInput = EmailBody | string;

interface PasswordResetTemplateData {
  resetUrl: string;
  expiresMinutes: number;
}

interface AccountActivationTemplateData {
  activationUrl: string;
  expiresHours: number;
}

interface HandicapUpdateTemplateData {
  oldIndex: number | null;
  newIndex: number;
  roundsUsed: number;
}

interface RoundUpdateTemplateData {
  eventType: 'round_submitted' | 'round_updated' | 'round_approved';
  status: 'pending' | 'approved' | 'rejected';
  grossScore: number;
  adjustedGrossScore: number;
  courseName: string;
  playedAt: string;
}

type TemplateData = {
  password_reset: PasswordResetTemplateData;
  account_activation: AccountActivationTemplateData;
  handicap_update: HandicapUpdateTemplateData;
  round_update: RoundUpdateTemplateData;
};

export interface SendEmailOptions {
  from?: string;
}

interface SendTemplatedEmailParams<T extends TemplateName> {
  to: string;
  template: T;
  data: TemplateData[T];
  from?: string;
}

interface EmailSenderInput {
  to: string;
  from: string;
  subject: string;
  body: EmailBody;
}

interface EmailLogger {
  error: (message: string, metadata: Record<string, unknown>) => void;
}

interface CreateEmailServiceOptions {
  resolveProvider?: () => EmailProvider;
  smtpSender?: (provider: EmailProvider, input: EmailSenderInput) => Promise<void>;
  sendgridSender?: (input: EmailSenderInput) => Promise<void>;
  logger?: EmailLogger;
}

function getProvider(): EmailProvider {
  const provider = String(env.emailTransport || '').toLowerCase();
  if (provider === 'mailpit' || provider === 'smtp' || provider === 'sendgrid' || provider === 'ses' || provider === 'mock') {
    return provider;
  }
  return 'smtp';
}

function buildFromAddress(): string {
  return `"${env.smtpFromName}" <${env.smtpFromEmail}>`;
}

function normalizeBody(body: EmailBodyInput): EmailBody {
  if (typeof body === 'string') {
    return { text: body };
  }
  return body;
}

function createSmtpTransport(provider: EmailProvider) {
  if (provider === 'mailpit') {
    return nodemailer.createTransport({
      host: env.mailpitSmtpHost,
      port: env.mailpitSmtpPort,
      secure: false,
      auth: undefined,
    });
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
  });
}

export function renderEmailTemplate<T extends TemplateName>(template: T, data: TemplateData[T]): { subject: string; body: EmailBody } {
  switch (template) {
    case 'password_reset': {
      const t = data as PasswordResetTemplateData;
      return {
        subject: 'Reset your password',
        body: {
          text: `You requested a password reset. Use this link (valid for ${t.expiresMinutes} minutes):\n\n${t.resetUrl}\n\nIf you did not request this, ignore this email.`,
          html: `<p>You requested a password reset. Click the link below (valid for ${t.expiresMinutes} minutes):</p><p><a href="${t.resetUrl}">${t.resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`,
        },
      };
    }
    case 'account_activation': {
      const t = data as AccountActivationTemplateData;
      return {
        subject: 'Activate your account',
        body: {
          text: `Welcome to Golf Handicap System. Activate your account using this link (valid for ${t.expiresHours} hours):\n\n${t.activationUrl}\n\nIf you did not request this account, ignore this email.`,
          html: `<p>Welcome to Golf Handicap System.</p><p>Activate your account using the link below (valid for ${t.expiresHours} hours):</p><p><a href="${t.activationUrl}">${t.activationUrl}</a></p><p>If you did not request this account, ignore this email.</p>`,
        },
      };
    }
    case 'handicap_update': {
      const t = data as HandicapUpdateTemplateData;
      const oldIndexLabel = t.oldIndex === null ? 'N/A' : t.oldIndex.toFixed(1);
      return {
        subject: 'Your handicap index has been updated',
        body: {
          text: `Your handicap index has changed.\n\nOld index: ${oldIndexLabel}\nNew index: ${t.newIndex.toFixed(1)}\nRounds used: ${t.roundsUsed}\n\nSign in to view your full handicap history.`,
          html: `<p>Your handicap index has changed.</p><ul><li><strong>Old index:</strong> ${oldIndexLabel}</li><li><strong>New index:</strong> ${t.newIndex.toFixed(1)}</li><li><strong>Rounds used:</strong> ${t.roundsUsed}</li></ul><p>Sign in to view your full handicap history.</p>`,
        },
      };
    }
    case 'round_update': {
      const t = data as RoundUpdateTemplateData;
      const statusLabel = t.status === 'approved' ? 'Approved' : t.status === 'pending' ? 'Pending Review' : 'Rejected';
      const eventLabel =
        t.eventType === 'round_submitted'
          ? 'Round Submitted'
          : t.eventType === 'round_updated'
            ? 'Round Updated'
            : 'Round Approved';
      return {
        subject: `${eventLabel}: ${t.courseName}`,
        body: {
          text: `Your round has been ${t.eventType === 'round_submitted' ? 'submitted' : t.eventType === 'round_updated' ? 'updated' : 'approved'}.\n\nCourse: ${t.courseName}\nPlayed: ${t.playedAt}\nGross Score: ${t.grossScore}\nAdjusted Score: ${t.adjustedGrossScore}\nStatus: ${statusLabel}\n\nSign in to view your round details.`,
          html: `<p>Your round has been <strong>${t.eventType === 'round_submitted' ? 'submitted' : t.eventType === 'round_updated' ? 'updated' : 'approved'}</strong>.</p><ul><li><strong>Course:</strong> ${t.courseName}</li><li><strong>Played:</strong> ${t.playedAt}</li><li><strong>Gross Score:</strong> ${t.grossScore}</li><li><strong>Adjusted Score:</strong> ${t.adjustedGrossScore}</li><li><strong>Status:</strong> ${statusLabel}</li></ul><p>Sign in to view your round details.</p>`,
        },
      };
    }
    default:
      return {
        subject: '',
        body: { text: '' },
      };
  }
}

function sendViaSendGrid(params: EmailSenderInput): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!env.sendgridApiKey) {
      reject(new Error('SENDGRID_API_KEY is required when EMAIL_TRANSPORT=sendgrid'));
      return;
    }

    const payload = JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from.replace(/^.*<([^>]+)>$/, '$1') },
      subject: params.subject,
      content: [
        ...(params.body.text ? [{ type: 'text/plain', value: params.body.text }] : []),
        ...(params.body.html ? [{ type: 'text/html', value: params.body.html }] : []),
      ],
    });

    const req = https.request(
      {
        hostname: 'api.sendgrid.com',
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.sendgridApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const status = res.statusCode || 500;
          if (status >= 200 && status < 300) {
            resolve();
            return;
          }
          const bodyText = Buffer.concat(chunks).toString('utf8');
          reject(new Error(`SendGrid send failed (${status}): ${bodyText}`));
        });
      },
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendViaSmtp(provider: EmailProvider, input: EmailSenderInput): Promise<void> {
  const transport = createSmtpTransport(provider);
  await transport.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.body.text,
    html: input.body.html,
  });
}

export function createEmailService(options: CreateEmailServiceOptions = {}) {
  const resolveProvider = options.resolveProvider || getProvider;
  const smtpSender = options.smtpSender || sendViaSmtp;
  const sendgridSender = options.sendgridSender || sendViaSendGrid;
  const logger = options.logger || {
    error: (message: string, metadata: Record<string, unknown>) => {
      console.error(message, metadata);
    },
  };

  const sendEmailInternal = async (
    to: string,
    subject: string,
    body: EmailBodyInput,
    sendOptions: SendEmailOptions = {},
  ): Promise<void> => {
    const provider = resolveProvider();
    const from = sendOptions.from || buildFromAddress();
    const normalizedBody = normalizeBody(body);

    try {
      if (provider === 'mock') {
        return;
      }

      if (provider === 'sendgrid') {
        await sendgridSender({ to, from, subject, body: normalizedBody });
        return;
      }

      // SES mode is supported through SMTP credentials.
      await smtpSender(provider, { to, from, subject, body: normalizedBody });
    } catch (error) {
      logger.error('[email.send] failed', {
        provider,
        to,
        subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const sendTemplatedEmailInternal = async <T extends TemplateName>(params: SendTemplatedEmailParams<T>): Promise<void> => {
    const rendered = renderEmailTemplate(params.template, params.data);
    await sendEmailInternal(params.to, rendered.subject, rendered.body, { from: params.from });
  };

  return {
    sendEmail: sendEmailInternal,
    sendTemplatedEmail: sendTemplatedEmailInternal,
  };
}

const emailService = createEmailService();

export async function sendEmail(to: string, subject: string, body: EmailBodyInput, options: SendEmailOptions = {}): Promise<void> {
  await emailService.sendEmail(to, subject, body, options);
}

export async function sendTemplatedEmail<T extends TemplateName>(params: SendTemplatedEmailParams<T>): Promise<void> {
  await emailService.sendTemplatedEmail(params);
}

export function getFromAddress(): string {
  return buildFromAddress();
}
