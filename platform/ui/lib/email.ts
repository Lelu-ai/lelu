import nodemailer, { type Transporter } from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const FROM = process.env.SMTP_FROM ?? process.env.SES_FROM ?? "Lelu <noreply@lelu-ai.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";

// Amazon SES over its HTTPS API — works on Vercel/serverless (SMTP ports are
// blocked there). Enabled when SES_REGION (or AWS_SES_REGION) is set; AWS
// credentials are read from the standard provider chain (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY env vars on Vercel).
let _ses: SESv2Client | null = null;

function sesClient(): SESv2Client | null {
  const region = process.env.SES_REGION ?? process.env.AWS_SES_REGION;
  if (!region) return null;
  if (!_ses) _ses = new SESv2Client({ region });
  return _ses;
}

async function sendViaSes(client: SESv2Client, to: string, subject: string, html: string): Promise<void> {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      },
    })
  );
}

// One transporter per serverless instance. Configured entirely from env vars —
// no credentials live in the repo.
//   SMTP_HOST=mail.lelu-ai.com
//   SMTP_PORT=587
//   SMTP_USER=noreply@lelu-ai.com
//   SMTP_PASS=********           (set as a secret — never commit)
//   SMTP_FROM="Lelu <noreply@lelu-ai.com>"  (optional)
let _transporter: Transporter | null = null;

function smtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (!_transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS (upgraded automatically)
      auth: { user, pass },
    });
  }
  return _transporter;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  // Priority: SES → Resend → SMTP → skip. The HTTPS providers (SES, Resend)
  // come first because Vercel/serverless blocks outbound SMTP; SMTP is only for
  // local dev or a non-serverless host (ECS/EC2).
  const ses = sesClient();
  if (ses) {
    await sendViaSes(ses, to, subject, html);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error:", res.status, body);
      throw new Error("Failed to send email");
    }
    return;
  }

  // SMTP last — only reachable on a non-serverless host or local dev.
  const transporter = smtpTransporter();
  if (transporter) {
    await transporter.sendMail({ from: FROM, to, subject, html });
    return;
  }

  console.warn("[email] No SES_REGION, RESEND_API_KEY, or SMTP_* configured — skipping email send.");
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  const firstName = name.split(" ")[0];

  await send(
    to,
    "Reset your Lelu password",
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E7E5E4;border-radius:12px;overflow:hidden;">

        <tr>
          <td style="background:#0A0A0A;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">lelu</span>
          </td>
        </tr>

        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">
              Reset your password
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.6;">
              Hi ${firstName}, we received a request to reset your Lelu password. Click the button below to choose a new one.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#0A0A0A;border-radius:8px;">
                  <a href="${link}"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;">
                    Reset password →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:13px;color:#A3A3A3;">
              This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
            </p>
            <p style="margin:0;font-size:12px;color:#C4C4C4;word-break:break-all;">
              ${link}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;border-top:1px solid #E7E5E4;">
            <p style="margin:0;font-size:12px;color:#A3A3A3;text-align:center;">
              © ${new Date().getFullYear()} Lelu · <a href="${BASE_URL}" style="color:#A3A3A3;">lelu-ai.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  );
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  const firstName = name.split(" ")[0];

  await send(
    to,
    "Verify your Lelu account",
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E7E5E4;border-radius:12px;overflow:hidden;">

        <tr>
          <td style="background:#0A0A0A;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">lelu</span>
          </td>
        </tr>

        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;">
              Verify your email
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.6;">
              Hi ${firstName}, thanks for signing up. Click the button below to verify your email address and activate your account.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#0A0A0A;border-radius:8px;">
                  <a href="${link}"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;">
                    Verify email address →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:13px;color:#A3A3A3;">
              This link expires in 24 hours. If you didn't create a Lelu account, you can ignore this email.
            </p>
            <p style="margin:0;font-size:12px;color:#C4C4C4;word-break:break-all;">
              ${link}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;border-top:1px solid #E7E5E4;">
            <p style="margin:0;font-size:12px;color:#A3A3A3;text-align:center;">
              © ${new Date().getFullYear()} Lelu · <a href="${BASE_URL}" style="color:#A3A3A3;">lelu-ai.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  );
}
