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
    propertyType = '',
    services = [],
    message = '',
    website = '' // honeypot
  } = body;

  // Honeypot: silently succeed so bots don't retry
  if (website && String(website).trim().length > 0) {
    return res.status(200).json({ success: true });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim();
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

  const serviceList = Array.isArray(services) ? services.filter(Boolean) : [];
  const servicesHtml = serviceList.length
    ? `<ul>${serviceList.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
    : '<p style="color:#888;">None selected</p>';

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e6e1d6;background:#faf8f3;font-weight:600;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border:1px solid #e6e1d6;">${value || '<span style="color:#888;">—</span>'}</td>
    </tr>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a; max-width:640px;">
      <h2 style="color:#2d5016; margin:0 0 16px;">New Quote Request — Don Wells Lawn Care</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        ${row('Name', escapeHtml(cleanName))}
        ${row('Email', `<a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a>`)}
        ${row('Phone', escapeHtml(phone))}
        ${row('Property Address', escapeHtml(address))}
        ${row('Property Type', escapeHtml(propertyType))}
        ${row('Services', servicesHtml)}
      </table>
      <h3 style="margin:24px 0 8px;color:#2d5016;">Message</h3>
      <div style="white-space:pre-wrap;padding:12px;background:#faf8f3;border:1px solid #e6e1d6;border-radius:8px;font-size:14px;">${escapeHtml(cleanMessage)}</div>
      <p style="margin-top:24px;font-size:12px;color:#888;">Submitted via donwellslawnandsnow.com</p>
    </div>
  `;

  const text = [
    `New Quote Request — Don Wells Lawn Care`,
    ``,
    `Name: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Phone: ${phone || '—'}`,
    `Property Address: ${address || '—'}`,
    `Property Type: ${propertyType || '—'}`,
    `Services: ${serviceList.length ? serviceList.join(', ') : '—'}`,
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
      subject: `New Quote Request from ${cleanName}`,
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
