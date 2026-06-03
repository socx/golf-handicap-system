import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmailService,
  renderEmailTemplate,
} from '../src/lib/email';

test('email service wrapper supports sendEmail(to, subject, body) signature', async () => {
  let captured: { provider: string; input: { to: string; subject: string; body: { text: string } } } | null = null;

  const service = createEmailService({
    resolveProvider: () => 'smtp',
    smtpSender: async (provider, input) => {
      captured = { provider, input: { to: input.to, subject: input.subject, body: { text: input.body.text } } };
    },
  });

  await service.sendEmail('user@example.com', 'Welcome', 'Hello from wrapper');

  assert.ok(captured);
  assert.equal(captured.provider, 'smtp');
  assert.equal(captured.input.to, 'user@example.com');
  assert.equal(captured.input.subject, 'Welcome');
  assert.equal(captured.input.body.text, 'Hello from wrapper');
});

test('email service wrapper supports templating via sendTemplatedEmail', async () => {
  let captured: { subject: string; body: { text: string } } | null = null;

  const service = createEmailService({
    resolveProvider: () => 'smtp',
    smtpSender: async (_provider, input) => {
      captured = { subject: input.subject, body: { text: input.body.text } };
    },
  });

  await service.sendTemplatedEmail({
    to: 'golfer@example.com',
    template: 'password_reset',
    data: {
      resetUrl: 'https://app.example.com/reset?token=abc',
      expiresMinutes: 60,
    },
  });

  assert.ok(captured);
  assert.equal(captured.subject, 'Reset your password');
  assert.equal(captured.body.text.includes('https://app.example.com/reset?token=abc'), true);
});

test('email service wrapper supports provider abstraction across sendgrid/ses/smtp', async () => {
  let sendgridCount = 0;
  let smtpCount = 0;

  const sendgridService = createEmailService({
    resolveProvider: () => 'sendgrid',
    sendgridSender: async (input) => {
      sendgridCount += 1;
      assert.equal(input.subject, 'Provider test');
    },
    smtpSender: async () => {
      throw new Error('smtp sender should not be used for sendgrid provider');
    },
  });

  await sendgridService.sendEmail('sg@example.com', 'Provider test', { text: 'sg' });

  const sesService = createEmailService({
    resolveProvider: () => 'ses',
    smtpSender: async (provider, input) => {
      smtpCount += 1;
      assert.equal(provider, 'ses');
      assert.equal(input.to, 'ses@example.com');
    },
  });

  await sesService.sendEmail('ses@example.com', 'Provider test', { text: 'ses' });

  assert.equal(sendgridCount, 1);
  assert.equal(smtpCount, 1);
});

test('email service wrapper logs failures and rethrows errors', async () => {
  let logged: { message: string; metadata: Record<string, unknown> } | null = null;

  const service = createEmailService({
    resolveProvider: () => 'smtp',
    smtpSender: async () => {
      throw new Error('smtp failure');
    },
    logger: {
      error: (message, metadata) => {
        logged = { message, metadata };
      },
    },
  });

  await assert.rejects(
    () => service.sendEmail('broken@example.com', 'Failure', 'body'),
    /smtp failure/,
  );

  assert.ok(logged);
  assert.equal(logged.message, '[email.send] failed');
  assert.equal(logged.metadata.to, 'broken@example.com');
  assert.equal(logged.metadata.provider, 'smtp');
});

test('renderEmailTemplate exposes template rendering helper', () => {
  const rendered = renderEmailTemplate('account_activation', {
    activationUrl: 'https://app.example.com/activate?token=xyz',
    expiresHours: 24,
  });

  assert.equal(rendered.subject, 'Activate your account');
  assert.equal(rendered.body.text.includes('https://app.example.com/activate?token=xyz'), true);
});
