import https from 'node:https';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

type EmailProvider = 'mailpit' | 'smtp' | 'sendgrid' | 'ses';
type TemplateName = 'password_reset' | 'account_activation';

interface EmailBody {
  text: string;
  html?: string;
}

interface PasswordResetTemplateData {
  resetUrl: string;
  expiresMinutes: number;
}

interface AccountActivationTemplateData {
  activationUrl: string;
  expiresHours: number;
}

type TemplateData = {
  password_reset: PasswordResetTemplateData;
  account_activation: AccountActivationTemplateData;
};

interface SendEmailOptions {
  from?: string;
}

interface SendTemplatedEmailParams<T extends TemplateName> {
  to: string;
  template: T;
  data: TemplateData[T];
  from?: string;
}

function getProvider(): EmailProvider {
  const provider = String(env.emailTransport || '').toLowerCase();
  if (provider === 'mailpit' || provider === 'smtp' || provider === 'sendgrid' || provider === 'ses') {
    return provider;
  }
  return 'smtp';
}

function buildFromAddress(): string {
  return `"${env.smtpFromName}" <${env.smtpFromEmail}>`;
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

function renderTemplate<T extends TemplateName>(template: T, data: TemplateData[T]): { subject: string; body: EmailBody } {
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
    default:
      return {
        subject: '',
        body: { text: '' },
      };
  }
}

function sendViaSendGrid(params: { to: string; from: string; subject: string; body: EmailBody }): Promise<void> {
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

export async function sendEmail(to: string, subject: string, body: EmailBody, options: SendEmailOptions = {}): Promise<void> {
  const provider = getProvider();
  const from = options.from || buildFromAddress();

  try {
    if (provider === 'sendgrid') {
      await sendViaSendGrid({ to, from, subject, body });
      return;
    }

    // SES mode is supported through SMTP credentials.
    const transport = createSmtpTransport(provider);
    await transport.sendMail({
      from,
      to,
      subject,
      text: body.text,
      html: body.html,
    });
  } catch (error) {
    console.error('[email.send] failed', {
      provider,
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function sendTemplatedEmail<T extends TemplateName>(params: SendTemplatedEmailParams<T>): Promise<void> {
  const rendered = renderTemplate(params.template, params.data);
  await sendEmail(params.to, rendered.subject, rendered.body, { from: params.from });
}

export function getFromAddress(): string {
  return buildFromAddress();
}
