import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
// Use onboarding@resend.dev for testing (no domain verification needed)
// Set EMAIL_FROM=Runway <noreply@yourdomain.com> once you verify a domain in Resend
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Runway <onboarding@resend.dev>';

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

// ── Shared HTML helpers ──────────────────────────────────────────────

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Runway</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.5;">
              &copy; ${new Date().getFullYear()} Runway Finance. All rights reserved.<br/>
              You received this email because you have an account with Runway.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buttonHtml(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;margin:8px 0;">${label}</a>`;
}

// ── Core send function ───────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (resend) {
    try {
      await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      console.log(`[EMAIL] Sent "${subject}" to ${to}`);
    } catch (err) {
      console.error(`[EMAIL] Failed to send "${subject}" to ${to}:`, err);
    }
  } else {
    console.log(`\n[EMAIL PREVIEW] To: ${to}\n  Subject: ${subject}\n  (Set RESEND_API_KEY to send real emails)\n`);
  }
}

// ── Public helpers ───────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Verify your email address</h2>
    <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
      Thanks for signing up for Runway! Please confirm your email address by clicking the button below.
    </p>
    ${buttonHtml(verifyUrl, 'Verify Email')}
    <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.5;">
      If you didn't create a Runway account, you can safely ignore this email.
    </p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;word-break:break-all;">
      Or copy this link: ${verifyUrl}
    </p>
  `);
  await sendEmail(email, 'Verify your email — Runway', html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Reset your password</h2>
    <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
      We received a request to reset the password for your Runway account. Click the button below to choose a new password.
    </p>
    ${buttonHtml(resetUrl, 'Reset Password')}
    <p style="margin:24px 0 0;color:#ef4444;font-size:13px;font-weight:500;">
      This link expires in 1 hour.
    </p>
    <p style="margin:12px 0 0;color:#71717a;font-size:13px;line-height:1.5;">
      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;word-break:break-all;">
      Or copy this link: ${resetUrl}
    </p>
  `);
  await sendEmail(email, 'Reset your password — Runway', html);
}

export async function sendFamilyInviteEmail(email: string, inviterName: string, token: string): Promise<void> {
  const joinUrl = `${APP_URL}/join-family?token=${token}`;
  const html = wrapHtml(`
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">You've been invited to a family plan</h2>
    <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
      <strong>${inviterName}</strong> has invited you to join their Runway family plan. Collaborate on budgets, share financial goals, and keep everyone on the same page.
    </p>
    ${buttonHtml(joinUrl, 'Join Family Plan')}
    <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.5;">
      If you don't know ${inviterName} or weren't expecting this invite, you can safely ignore this email.
    </p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;word-break:break-all;">
      Or copy this link: ${joinUrl}
    </p>
  `);
  await sendEmail(email, `${inviterName} invited you to Runway`, html);
}
