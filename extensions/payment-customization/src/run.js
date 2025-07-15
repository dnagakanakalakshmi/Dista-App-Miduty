// @ts-check

/**
* @typedef {import("../generated/api").RunInput} RunInput
* @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
*/

/**
* @type {FunctionRunResult}
*/
const NO_CHANGES = {
  operations: [],
};

/**
* @param {RunInput} input
* @returns {FunctionRunResult}
*/
export function run(input) {
  // Get validation functions from metafield
  const validationFunctionsMetafield = input.shop.validationFunctions;
  let validationFunctions = [];

  try {
    validationFunctions = JSON.parse(validationFunctionsMetafield?.value || "[]");
  } catch (error) {
    console.error("Error parsing validation functions:", error);
    return NO_CHANGES;
  }

  const countryCode = input.localization.country.isoCode;
  const postalCode = input.cart?.deliveryGroups?.[0]?.deliveryAddress?.zip;
  const cartTotal = input.cart?.cost?.subtotalAmount?.amount;
  if (!countryCode || !cartTotal) return NO_CHANGES;

  // Collect all gateways to block based on rules
  let blockedGateways = new Set();

  // Process only enabled functions
  validationFunctions
    .filter(func => func.enabled)
    .forEach(func => {
      // Process only payment rules
      func.rules
        .filter(rule => rule.type === "payment")
        .forEach(rule => {
          const conditionMatchType = rule.conditionMatchType || "all";
          const conditionResults = [];

          // Process each condition in the payment rule
          rule.conditions.forEach(condition => {
            let conditionResult = false;

            if (condition.mode === "country" && Array.isArray(condition.keys)) {
              const isMatch = condition.keys.includes(countryCode);
              // Block if country matches when include=true, or doesn't match when include=false
              conditionResult = condition.include ? isMatch : !isMatch;
            }

            if (condition.mode === "zip" && Array.isArray(condition.keys) && postalCode) {
              let isMatch = false;
              for (const zipRule of condition.keys) {
                if (
                  (zipRule.endsWith("*") && postalCode.startsWith(zipRule.slice(0, -1))) ||
                  postalCode === zipRule
                ) {
                  isMatch = true;
                  break;
                }
              }
              // Block if zip matches when include=true, or doesn't match when include=false
              conditionResult = condition.include ? isMatch : !isMatch;
            }

            if (condition.mode === "max_cart_value" && Array.isArray(condition.keys) && condition.keys.length > 0) {
              const maxCartValue = parseFloat(condition.keys[0]);
              const presentmentcurrencyRate = parseFloat(input.presentmentCurrencyRate) || 1;
              const maxCartValueInPresentmentCurrency = maxCartValue * presentmentcurrencyRate;
              // Block if cart value is GREATER than max value
              conditionResult = parseFloat(cartTotal) > maxCartValueInPresentmentCurrency;
            }

            conditionResults.push(conditionResult);
          });

          // Determine if we should block based on conditionMatchType
          let shouldBlock = false;
          if (conditionMatchType === "all") {
            shouldBlock = conditionResults.every(result => result === true);
          } else { // "any"
            shouldBlock = conditionResults.some(result => result === true);
          }

          // If conditions are met, add gateways to blocked list
          if (shouldBlock) {
            rule.gateways.forEach(gw => blockedGateways.add(gw));
          }
        });
    });

  if (blockedGateways.size === 0) return NO_CHANGES;

  // Hide all payment methods whose name matches any in the blocked list
  const operations = input.paymentMethods
    .filter(method => blockedGateways.has(method.name))
    .map(method => ({
      hide: { paymentMethodId: method.id }
    }));

  return { operations };
}