// Centralized platform-fee math. When tiered fees come, only this function changes.
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 10;

function calculatePlatformFee(amount) {
  const total = parseFloat(amount);
  const fee = parseFloat((total * (PLATFORM_FEE_PERCENT / 100)).toFixed(2));
  const payout = parseFloat((total - fee).toFixed(2));
  return { platformFee: fee, sellerPayout: payout };
}

module.exports = { calculatePlatformFee, PLATFORM_FEE_PERCENT };
