const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT || '587', 10),
    secure: false,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return transporter;
}

const FROM = process.env.EMAIL_FROM || 'Vaultive Auctions <noreply@vaultive.com>';

async function send(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email STUB] To: ${to} | Subject: ${subject}`);
    return;
  }
  await t.sendMail({ from: FROM, to, subject, html });
}

exports.sendPickupScheduledToSeller = (sellerEmail, cardName, pickupNote) =>
  send(
    sellerEmail,
    `Pickup scheduled for your card: ${cardName}`,
    `<p>Hi,</p>
     <p>We have scheduled a pickup for your card <strong>${cardName}</strong>.</p>
     <p><strong>Pickup details:</strong> ${pickupNote || 'Our team will be in touch with the exact time.'}</p>
     <p>Your payout will be released when we collect the card from you.</p>
     <p>— Vaultive Auctions</p>`
  );

exports.sendCardPickedUpToBuyer = (buyerEmail, cardName) =>
  send(
    buyerEmail,
    `Your card is on its way: ${cardName}`,
    `<p>Hi,</p>
     <p>Great news! We have picked up <strong>${cardName}</strong> from the seller and your card is now on its way to you.</p>
     <p>We will update you once delivery is complete.</p>
     <p>— Vaultive Auctions</p>`
  );

exports.sendDeliveryConfirmationToBuyer = (buyerEmail, cardName) =>
  send(
    buyerEmail,
    `Delivery complete: ${cardName}`,
    `<p>Hi,</p>
     <p>Your card <strong>${cardName}</strong> has been delivered. We hope you enjoy it!</p>
     <p>If you have any issues, please contact our support team.</p>
     <p>— Vaultive Auctions</p>`
  );
