// Local AWS SES send test. Run after filling SES_REGION + AWS creds in .env.local.
//   node scripts/ses-test.mjs you@example.com
// In the SES sandbox, the recipient must be a verified identity.
import fs from "node:fs";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const env = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const region = env.SES_REGION || env.AWS_SES_REGION;
const to = process.argv[2];
if (!region) { console.error("Set SES_REGION in .env.local"); process.exit(1); }
if (!to) { console.error("Usage: node scripts/ses-test.mjs <recipient@email>"); process.exit(1); }

const client = new SESv2Client({
  region,
  credentials: env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined, // fall back to the default AWS credential chain
});

try {
  const res = await client.send(new SendEmailCommand({
    FromEmailAddress: env.SES_FROM || "Lelu <noreply@lelu-ai.com>",
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: "Lelu SES test ✔", Charset: "UTF-8" },
        Body: { Html: { Data: "<p>If you got this, AWS SES works for Lelu's reset emails.</p>", Charset: "UTF-8" } },
      },
    },
  }));
  console.log(`✅ Sent via SES (${region}) → ${to}  MessageId: ${res.MessageId}`);
} catch (e) {
  console.error("❌ SES send failed:", e.name, "-", e.message);
  if (String(e.message).match(/not verified|sandbox/i))
    console.error("   → In the SES sandbox you can only send to verified addresses, or request production access.");
  process.exit(1);
}
