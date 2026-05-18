// TODO: Replace this stub with the real Airwallex SDK once API keys are configured.
// Airwallex docs: https://www.airwallex.com/docs/payouts

exports.releasePayout = async (invoice) => {
  console.log(
    `[Airwallex STUB] Would release $${invoice.seller_payout_amount} ` +
    `to seller_id=${invoice.seller_id} for invoice_id=${invoice.id}`
  );
  return { status: 'stub_success', invoice_id: invoice.id };
};
