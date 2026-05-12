import nodemailer from 'nodemailer';

/**
 * EmailService
 *
 * Sends vendor RFQ invitation emails with a branded "CLICK HERE" button
 * linking to the vendor's unique portal URL.
 *
 * SMTP config via .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *   EMAIL_FROM       – sender display name + address, e.g. "RSM Procurement <proc@rsm.us>"
 *   EMAIL_PREVIEW    – set to "true" to skip sending and log the preview URL instead
 *
 * When SMTP_HOST is not configured, falls back to Ethereal (catch-all test account)
 * and logs a preview URL to the console — perfect for demos without a real mail server.
 */
export class EmailService {
  private transporterPromise: Promise<nodemailer.Transporter>;

  constructor() {
    this.transporterPromise = this.createTransporter();
  }

  private async createTransporter(): Promise<nodemailer.Transporter> {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // No SMTP configured — use Ethereal test account (emails viewable at ethereal.email)
    const testAccount = await nodemailer.createTestAccount();
    console.log('[Email] No SMTP configured — using Ethereal test account:', testAccount.user);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  // ─── HTML Template ─────────────────────────────────────────────────────────

  buildEmailHtml(opts: {
    rfqNumber: string;
    rfqTitle: string;
    vendorName: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string;
    companyName: string;
    expirationDate: string;
    portalUrl: string;
  }): string {
    const {
      rfqNumber, rfqTitle, vendorName, buyerName,
      buyerPhone, buyerEmail, companyName, expirationDate, portalUrl,
    } = opts;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>RFQ Response – ${rfqNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">

      <!-- Card -->
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header bar -->
        <tr>
          <td colspan="2"
              style="background:#1a3a5c;padding:18px 30px;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">
            RFQ Response
          </td>
        </tr>

        <!-- Body + button panel -->
        <tr>

          <!-- Left: letter body -->
          <td valign="top" style="padding:30px 24px 30px 30px;color:#333333;font-size:14px;line-height:1.7;width:380px;">
            <p style="margin:0 0 12px;">
              Please press the <strong>CLICK HERE</strong> button on the right to open a new window.
            </p>
            <p style="margin:0 0 12px;">
              Please find attached a copy of our RFQ <strong>${rfqNumber}</strong>${rfqTitle ? ' – ' + rfqTitle : ''}.
            </p>
            <p style="margin:0 0 12px;">
              This quotation request expires on <strong>${expirationDate}</strong>.
            </p>
            <p style="margin:0 0 24px;">
              Should you require any further information, please do not hesitate to contact me.
            </p>
            <p style="margin:0;">Yours Sincerely,</p>
            <br/>
            <p style="margin:0;font-weight:bold;">${buyerName}</p>
            <p style="margin:0;">${companyName}</p>
            ${buyerPhone ? `<p style="margin:0;">Telephone: ${buyerPhone}</p>` : ''}
            ${buyerEmail ? `<p style="margin:0;">Email: <a href="mailto:${buyerEmail}" style="color:#1a5276;">${buyerEmail}</a></p>` : ''}
          </td>

          <!-- Right: CTA panel -->
          <td valign="top" align="center"
              style="background:#eef2f8;padding:30px 20px;width:200px;border-left:1px solid #dce3ee;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:bold;color:#1a3a5c;text-transform:uppercase;letter-spacing:0.5px;">
              View RFQ
            </p>
            <!-- CTA button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td align="center"
                    style="background:#e8722a;border-radius:4px;padding:14px 22px;">
                  <a href="${portalUrl}"
                     style="color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;white-space:nowrap;">
                    CLICK HERE
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:11px;color:#777777;text-align:center;">
              Dear ${vendorName},<br/>this link is unique to your account.
            </p>
          </td>

        </tr>

        <!-- Divider -->
        <tr>
          <td colspan="2" style="padding:0 30px;">
            <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;"/>
          </td>
        </tr>

        <!-- Fallback link section -->
        <tr>
          <td colspan="2" style="padding:20px 30px 28px;font-size:12px;color:#555555;">
            <p style="margin:0 0 8px;font-weight:bold;">Button not working?</p>
            <p style="margin:0 0 6px;">
              Don't worry. Either copy and paste or type the link below into your web browser and hit the 'enter' key.
            </p>
            <p style="margin:0 0 6px;">
              <a href="${portalUrl}" style="color:#1a5276;word-break:break-all;">${portalUrl}</a>
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`;
  }

  // ─── Plain-text fallback ────────────────────────────────────────────────────

  buildEmailText(opts: {
    rfqNumber: string;
    rfqTitle: string;
    vendorName: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string;
    companyName: string;
    expirationDate: string;
    portalUrl: string;
  }): string {
    return [
      `RFQ Response – ${opts.rfqNumber}`,
      '',
      `Dear ${opts.vendorName},`,
      '',
      `Please find attached a copy of our RFQ ${opts.rfqNumber}${opts.rfqTitle ? ' – ' + opts.rfqTitle : ''}.`,
      `This quotation request expires on ${opts.expirationDate}.`,
      '',
      `To respond, please visit:`,
      opts.portalUrl,
      '',
      `Should you require any further information, please contact:`,
      opts.buyerName,
      opts.companyName,
      opts.buyerPhone,
      opts.buyerEmail,
    ].filter(l => l !== undefined).join('\n');
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  async sendRFQInvite(opts: {
    toEmail: string;
    toName: string;
    rfqNumber: string;
    rfqTitle: string;
    vendorName: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string;
    companyName: string;
    expirationDate: string;
    portalUrl: string;
  }): Promise<{ messageId: string; previewUrl?: string }> {
    const transporter = await this.transporterPromise;
    const from = process.env.EMAIL_FROM ?? `"${opts.companyName} Procurement" <noreply@supplier-portal.local>`;

    const html = this.buildEmailHtml(opts);
    const text = this.buildEmailText(opts);

    const info = await transporter.sendMail({
      from,
      to: `"${opts.toName}" <${opts.toEmail}>`,
      subject: `Request for Quotation ${opts.rfqNumber}${opts.rfqTitle ? ' – ' + opts.rfqTitle : ''}`,
      html,
      text,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[Email] Preview for ${opts.toEmail}: ${previewUrl}`);
    }

    return { messageId: info.messageId, previewUrl: previewUrl || undefined };
  }
}

export const emailService = new EmailService();
