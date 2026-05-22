import nodemailer from 'nodemailer';
import { env } from '../config/env';

export function createMailTransport() {
  if (env.emailTransport === 'mailpit') {
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

export function getFromAddress(): string {
  return `"${env.smtpFromName}" <${env.smtpFromEmail}>`;
}
