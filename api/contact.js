import { Resend } from 'resend';

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
    : (req.body || {});

  const {
    name = '',
    email = '',
    phone = '',
    address = '',
    message = '',
    website = '' // honeypot
  } = body;

  // Honeypot: silently succeed so bots don't retry
  if (website && String(website).trim().length > 0) {
    return res.status(200).json({ success: true });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim();
  const cleanPhone = String(phone).trim();
  const cleanAddress = String(address).trim();
  const cleanMessage = String(message).trim();

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (cleanMessage.length < 10) {
    return res.status(400).json({ error: 'Message must be at least 10 characters.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return res.status(500).json({ error: 'Server email configuration missing.' });
  }

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px;border:1px solid #e6e6e6;background:#f6f6f6;font-weight:600;width:170px;color:#333;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border:1px solid #e6e6e6;color:#222;">${value || '<span style="color:#888;">&mdash;</span>'}</td>
    </tr>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#222; max-width:640px;">
      <h2 style="color:#8dc100; margin:0 0 6px; font-family: Montserrat, sans-serif;">New Free Estimate Request</h2>
      <p style="color:#666; margin:0 0 20px;">Don Wells Lawn &amp; Snow &mdash; donwellslawnandsnow.com</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        ${row('Name', escapeHtml(cleanName))}
        ${row('Email', `<a href="mailto:${escapeHtml(cleanEmail)}" style="color:#7aa800;">${escapeHtml(cleanEmail)}</a>`)}
        ${row('Phone', cleanPhone ? `<a href="tel:${escapeHtml(cleanPhone)}" style="color:#7aa800;">${escapeHtml(cleanPhone)}</a>` : '')}
        ${row('Address', escapeHtml(cleanAddress))}
      </table>
      <h3 style="margin:24px 0 8px;color:#8dc100;font-family: Montserrat, sans-serif;">Message</h3>
      <div style="white-space:pre-wrap;padding:14px;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:6px;font-size:14px;line-height:1.55;">${escapeHtml(cleanMessage)}</div>
      <p style="margin-top:24px;font-size:12px;color:#888;">Reply directly to this email to respond to ${escapeHtml(cleanName)}.</p>
    </div>
  `;

  const text = [
    `New Free Estimate Request — Don Wells Lawn & Snow`,
    ``,
    `Name: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Phone: ${cleanPhone || '—'}`,
    `Address: ${cleanAddress || '—'}`,
    ``,
    `Message:`,
    cleanMessage,
    ``,
    `Submitted via donwellslawnandsnow.com`
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: cleanEmail,
      subject: `New estimate request from ${cleanName}`,
      html,
      text
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({ error: 'Could not send email. Please try again later.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
}
