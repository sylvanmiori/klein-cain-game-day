import nodemailer from 'nodemailer';
import edition from '../content/current-edition.json' with { type:'json' };

const required = ['GMAIL_USER','GMAIL_APP_PASSWORD','NEWSLETTER_TO','PUBLIC_URL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing mail configuration: ${missing.join(', ')}`);

const url = process.env.PUBLIC_URL.replace(/\/$/, '');
const transport = nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD } });
await transport.sendMail({
  from:`Cain Game Day <${process.env.GMAIL_USER}>`,
  to:process.env.NEWSLETTER_TO,
  subject:`Game day: Klein Cain vs ${edition.opponent}`,
  text:`Tonight: Klein Cain vs ${edition.opponent}, ${edition.kickoff} at ${edition.venue}. Read the game-day report: ${url}`,
  html:`<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;padding:28px;color:#151515"><p style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#612694">CAIN GAME DAY · ISSUE ${edition.issue}</p><h1 style="font-size:28px;line-height:1.1;font-weight:900">Klein Cain vs ${edition.opponent}</h1><p>${edition.kickoff} · ${edition.venue}</p><p style="margin:28px 0"><a href="${url}" style="background:#612694;color:white;text-decoration:none;padding:13px 18px;font-weight:800">Read the report</a></p></div>`
});
console.log(`Sent issue ${edition.issue}.`);
