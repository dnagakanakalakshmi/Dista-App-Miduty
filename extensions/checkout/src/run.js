// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const step = input.buyerJourney.step;

  if (step !== 'CHECKOUT_INTERACTION' && step !== 'CHECKOUT_COMPLETION') {
    return { errors: [] };
  }

  const currencyCode = input.cart.cost.subtotalAmount.currencyCode;
  const subtotalAmount = parseFloat(input.cart.cost.subtotalAmount.amount);
  const presentmentcurrencyRate = input.presentmentCurrencyRate || 1;
  const totalQuantity = input.cart.lines.reduce((sum, line) => sum + line.quantity, 0);

  // Get validation functions from metafield
  const validationFunctionsMetafield = input.shop.validationFunctions;
  let validationFunctions = [];

  try {
    validationFunctions = JSON.parse(validationFunctionsMetafield?.value || "[]");
  } catch (error) {
    console.error("Error parsing validation functions:", error);
    return { errors: [] };
  }

  const errors = [];

  // Loop through enabled functions
  validationFunctions
    .filter(func => func.enabled)
    .forEach(func => {
      // Process each rule in the function
      func.rules.forEach(rule => {
        if (rule.type === "minval") {
          const minValue = parseInt(rule.value);
          const minValueInPresentmentCurrency = parseInt((minValue * presentmentcurrencyRate).toString());

          if (subtotalAmount < minValueInPresentmentCurrency) {
            errors.push({
              localizedMessage: `Minimum cart value must be ${minValueInPresentmentCurrency} ${currencyCode} to proceed.`,
              target: "cart"
            });
          }
        }

        else if (rule.type === "orderlimit") {
          const orderLimit = parseInt(rule.value);

          if (orderLimit > 0 && totalQuantity > orderLimit) {
            errors.push({
              localizedMessage: `You can only order up to ${orderLimit} items per order.`,
              target: "cart"
            });
          }
        }
      });
    });

  return { errors };
}