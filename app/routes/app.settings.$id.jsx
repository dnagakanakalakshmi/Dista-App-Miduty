import { Form, useLoaderData, useParams, useNavigation, useActionData, useLocation, useFetcher } from "@remix-run/react";
import {
  Page, Card, TextField, Button, Banner, Text, BlockStack,
  Checkbox, Select, Autocomplete, Tag, InlineStack,
  Modal
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { Spinner } from "@shopify/polaris";
import * as Flags from 'country-flag-icons/react/3x2';


const PAYMENT_GATEWAYS = [
  { label: "Shopify Payments", value: "shopify_payments", icon: "💳" },
  { label: "Shop Pay", value: "shop_pay", icon: "🛒" },
  { label: "PayPal", value: "paypal", icon: "🅿️" },
  { label: "Apple Pay", value: "apple_pay", icon: "🍏" },
  { label: "Google Pay", value: "google_pay", icon: "🤖" },
  { label: "Amazon Pay", value: "amazon_pay", icon: "🛒" },
  { label: "Cash on Delivery (COD)", value: "cash_on_delivery", icon: "💵" },
];

const CONDITION_OPTIONS = [
  { label: "Minimum Cart Value", value: "minval" },
  { label: "Order Limit", value: "orderlimit" },
  { label: "Payment Gateway Hiding", value: "payment" }
];

function renderSelectedTags(selected, options, onRemove) {
  const maxToShow = 3;
  const tagsToShow = selected.slice(0, maxToShow);
  const extraCount = selected.length - maxToShow;

  return (
    <div className="multiSelectTags">
      {tagsToShow.map((value) => {
        const opt = options.find((opt) => opt.value === value);
        const FlagIcon = Flags[opt?.value];
        return (
          <Tag key={value} onRemove={() => onRemove(value)}>
            {FlagIcon && <FlagIcon style={{ width: 24, height: 16, marginRight: 8, verticalAlign: 'middle' }} />}
            {opt?.label || value}
          </Tag>
        );
      })}
      {extraCount > 0 && (
        <Tag key="more" disabled>
          +{extraCount} more
        </Tag>
      )}
    </div>
  );
}

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        id
        currencyCode
        validationFunctions: metafield(
          namespace: "cart_validation", 
          key: "validation_functions"
        ) { value }
      }
    }
  `);

  const data = await response.json();
  let functions = [];

  try {
    const raw = data.data.shop.validationFunctions?.value;
    functions = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error parsing functions:", error);
  }

  const currentFunction = functions.find(fn => fn.id === params.id);

  if (!currentFunction) {
    throw new Response("Not Found", { status: 404 });
  }

  // Get country options
  const countryQuery = `
    {
      __type(name: "CountryCode") {
        enumValues {
          name
          description
        }
      }
    }
  `;
  const countryResponse = await admin.graphql(countryQuery);
  const countryJson = await countryResponse.json();
  const countryOptions = countryJson.data.__type.enumValues.map(c => ({
    label: c.description.replace(/\.$/, "") || c.name,
    value: c.name,
  }));

  return json({
    function: currentFunction,
    currency: data.data.shop.currencyCode,
    countryOptions,
    allFunctions: functions // Add this to return all functions
  });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const functionId = formData.get("functionId");

  if (actionType === "moveMinValue" || actionType === "moveOrderLimit") {
    try {
      const updatedFunctions = JSON.parse(formData.get("functions"));
      const shopIdResponse = await admin.graphql(`query { shop { id } }`);
      const shopId = (await shopIdResponse.json()).data.shop.id;
      const result = await admin.graphql(`
        mutation {
          metafieldsSet(metafields: [{
            namespace: "cart_validation",
            key: "validation_functions",
            type: "json",
            value: ${JSON.stringify(JSON.stringify(updatedFunctions))},
            ownerId: "${shopId}"
          }]) {
            metafields { id }
            userErrors { field message }
          }
        }
      `);
      const response = await result.json();
      if (response.data?.metafieldsSet?.userErrors?.length > 0) {
        return json({
          error: response.data.metafieldsSet.userErrors[0].message
        });
      }
      return json({ success: true });
    } catch (error) {
      console.error("Error moving value:", error);
      return json({
        error: "Failed to move value. Please try again."
      });
    }
  }

  const functionsJson = formData.get("functions");

  try {
    const shopInfoResponse = await admin.graphql(`
      query {
        shop {
          id
          currencyCode
        }
      }
    `);
    const shopInfoJson = await shopInfoResponse.json();
    const shopGid = shopInfoJson.data.shop.id;
    const currency = shopInfoJson.data.shop.currencyCode;

    const updates = JSON.parse(functionsJson);

    // Get existing functions
    const response = await admin.graphql(`
      query {
        shop {
          validationFunctions: metafield(
            namespace: "cart_validation", 
            key: "validation_functions"
          ) { value }
        }
      }
    `);

    const data = await response.json();
    let existingFunctions = [];

    try {
      existingFunctions = data.data.shop.validationFunctions?.value
        ? JSON.parse(data.data.shop.validationFunctions.value)
        : [];
    } catch (error) {
      console.error("Error parsing functions:", error);
    }


    const updatedFunctions = existingFunctions.map(fn => {
      if (fn.id === functionId) {
        return {
          ...fn,
          rules: updates.rules || fn.rules,
          enabled: updates.enabled
        };
      }
      return fn;
    });

    // Save updated functions
    const escapedJSONString = JSON.stringify(JSON.stringify(updatedFunctions)).slice(1, -1);
    const result = await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [{
          namespace: "cart_validation",
          key: "validation_functions",
          type: "json",
          value: "${escapedJSONString}",
          ownerId: "${shopGid}"
        }]) {
          metafields { id }
        }
      }
    `);

    return redirect("/app/settings");
  } catch (error) {
    console.error("Error saving function:", error);
    return json({ error: "Error processing request" }, { status: 500 });
  }
};


export default function FunctionEditor() {
  const loaderData = useLoaderData();
  const { id } = useParams();
  const navigation = useNavigation();

  if (!loaderData || navigation.state === "loading") {
    return null;
  }

  const fetcher = useFetcher();
  const [functionTitle, setFunctionTitle] = useState("");
  const [functionRules, setFunctionRules] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [editingRuleIdx, setEditingRuleIdx] = useState(null);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [conditionType, setConditionType] = useState("minval");
  const [paymentMode, setPaymentMode] = useState("country");
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [zipCodeFields, setZipCodeFields] = useState([""]);
  const [selectedGateways, setSelectedGateways] = useState([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [gatewaySearch, setGatewaySearch] = useState("");
  const [includeOrExclude, setIncludeOrExclude] = useState("include");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [orderLimitValue, setOrderLimitValue] = useState("");
  const [conditionMatchType, setConditionMatchType] = useState("all");
  const [showMinValueModal, setShowMinValueModal] = useState(false);
  const [existingMinValueFunction, setExistingMinValueFunction] = useState(null);
  const [pendingMinValue, setPendingMinValue] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showOrderLimitModal, setShowOrderLimitModal] = useState(false);
  const [existingOrderLimitFunction, setExistingOrderLimitFunction] = useState(null);
  const [pendingOrderLimit, setPendingOrderLimit] = useState("");


  const currentFunction = loaderData?.function;
  const currency = loaderData?.currency || "";
  const countryOptions = loaderData?.countryOptions || [];
  const allFunctions = loaderData?.allFunctions || [];


  useEffect(() => {
    setFunctionTitle(currentFunction?.title || "");
    setFunctionRules(currentFunction?.rules || []);
    setIsEnabled(currentFunction?.enabled || false);
  }, [currentFunction]);


  if (!loaderData || navigation.state === "loading") {
    return (
      <Page title="Loading...">
        <BlockStack gap="400">
          <Spinner accessibilityLabel="Loading function" size="large" />
        </BlockStack>
      </Page>
    );
  }

  if (!currentFunction) {
    return (
      <Page title="Function Editor">
        <BlockStack gap="400">
          <Banner title="Function not found" tone="critical">
            This function does not exist or is still loading. Please refresh the page.
          </Banner>
        </BlockStack>
      </Page>
    );
  }

  const countryOptionsForAutocomplete = countryOptions.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));

  const paymentGatewayOptions = PAYMENT_GATEWAYS.map(pg => ({
    value: pg.value,
    label: `${pg.icon} ${pg.label}`,
  }));

  const handleAddCondition = (ruleIndex) => {
    setEditingRuleIdx(null);
    setShowConditionForm(true);
    setConditionType("payment");
    setSelectedGateways(
      PAYMENT_GATEWAYS.filter((pg) =>
        functionRules[ruleIndex].gateways.includes(pg.label)
      ).map((pg) => pg.value)
    );
    setPaymentMode("country");
    setSelectedCountries([]);
    setZipCodeFields([""]);
    setMaxValue("");
    setIncludeOrExclude("include");
    setConditionMatchType(functionRules[ruleIndex].conditionMatchType || "all");
  };

  const handleRemoveCondition = (ruleIndex, conditionIndex) => {
    const newRules = [...functionRules];
    const rule = newRules[ruleIndex];
    rule.conditions = rule.conditions.filter((_, idx) => idx !== conditionIndex);

    if (rule.conditions.length === 0) {
      newRules.splice(ruleIndex, 1);
    }

    setFunctionRules(newRules);
  };

  const handleEditCondition = (ruleIndex, conditionIndex) => {
    const rule = functionRules[ruleIndex];
    const condition = rule.conditions[conditionIndex];

    setEditingRuleIdx(conditionIndex);
    setShowConditionForm(true);
    setConditionType("payment");
    setPaymentMode(condition.mode);
    setIncludeOrExclude(condition.include === false ? "exclude" : "include");
    setConditionMatchType(rule.conditionMatchType || "all");

    if (condition.mode === "country") {
      setSelectedCountries(condition.keys || []);
      setZipCodeFields([""]);
      setMaxValue("");
    } else if (condition.mode === "zip") {
      setZipCodeFields((condition.keys || []).join(",").split(",").map((z) => z.trim()));
      setSelectedCountries([]);
      setMaxValue("");
    } else if (condition.mode === "max_cart_value") {
      setMaxValue(condition.keys[0] || "");
      setSelectedCountries([]);
      setZipCodeFields([""]);
    }

    setSelectedGateways(
      PAYMENT_GATEWAYS.filter((pg) =>
        rule.gateways.includes(pg.label)
      ).map((pg) => pg.value)
    );
  };

  const findFunctionWithMinValue = () => {
    const response = allFunctions?.find(fn =>
      fn.rules?.some(rule => rule.type === "minval") && fn.id !== currentFunction.id
    );
    return response;
  };

  const findFunctionWithOrderLimit = () => {
    return allFunctions?.find(fn =>
      fn.rules?.some(rule => rule.type === "orderlimit") && fn.id !== currentFunction.id
    );
  };

  const handleAddOrUpdateRule = () => {

    if (conditionType === "minval") {
      const functionWithMinValue = findFunctionWithMinValue();
      if (functionWithMinValue) {
        setExistingMinValueFunction(functionWithMinValue);
        setPendingMinValue(minValue);
        setShowMinValueModal(true);
        return;
      }
    }

    if (conditionType === "orderlimit") {
      const functionWithOrderLimit = findFunctionWithOrderLimit();
      if (functionWithOrderLimit) {
        setExistingOrderLimitFunction(functionWithOrderLimit);
        setPendingOrderLimit(orderLimitValue);
        setShowOrderLimitModal(true);
        return;
      }
    }

    let newRule = null;
    let newRules = [...functionRules];

    if (conditionType === "minval") {
      if (!minValue) return;
      newRule = { type: "minval", value: minValue };
      const minRuleIdx = functionRules.findIndex((r) => r.type === "minval");
      if (minRuleIdx !== -1 && editingRuleIdx === null) {
        newRules[minRuleIdx] = newRule;
      } else if (editingRuleIdx !== null) {
        newRules[editingRuleIdx] = newRule;
      } else {
        newRules.push(newRule);
      }
    } else if (conditionType === "orderlimit") {
      if (!orderLimitValue) return;
      newRule = { type: "orderlimit", value: orderLimitValue };
      const orderRuleIdx = functionRules.findIndex((r) => r.type === "orderlimit");
      if (orderRuleIdx !== -1 && editingRuleIdx !== null) {
        newRules[orderRuleIdx] = newRule;
      } else if (editingRuleIdx !== null) {
        newRules[editingRuleIdx] = newRule;
      } else {
        newRules.push(newRule);
      }
    } else if (conditionType === "payment") {
      const allZipCodes = zipCodeFields.join(",");
      const keys =
        paymentMode === "country"
          ? selectedCountries.filter(Boolean)
          : paymentMode === "max_cart_value"
            ? [maxValue]
            : allZipCodes.split(",").map((z) => z.trim()).filter(Boolean);

      const gateways = PAYMENT_GATEWAYS.filter((pg) =>
        selectedGateways.includes(pg.value)
      ).map((pg) => pg.label);

      if (editingRuleIdx !== null) {
        const updatedRule = { ...functionRules[editingRuleIdx] };
        updatedRule.gateways = gateways;
        const newRules = [...functionRules];
        newRules[editingRuleIdx] = updatedRule;
        setFunctionRules(newRules);
        setEditingRuleIdx(null);
        setShowConditionForm(false);
        setConditionType("");
        setPaymentMode("country");
        setSelectedCountries([]);
        setZipCodeFields([""]);
        setSelectedGateways([]);
        setMinValue("");
        setMaxValue("");
        setOrderLimitValue("");
        return;
      }

      if (keys.length === 0 || selectedGateways.length === 0) return;

      const newCondition = {
        mode: paymentMode,
        keys,
        include: includeOrExclude === "include",
      };

      const existingRuleIndex = functionRules.findIndex(
        (r) => r.type === "payment" &&
          JSON.stringify([...new Set(r.gateways)].sort()) ===
          JSON.stringify([...new Set(gateways)].sort())
      );

      if (existingRuleIndex !== -1) {
        const existingRule = functionRules[existingRuleIndex];
        const updatedConditions = [...(existingRule.conditions || [])];


        const existingConditionIndex = updatedConditions.findIndex(
          c => c.mode === paymentMode && c.include === (includeOrExclude === "include")
        );

        if (existingConditionIndex !== -1) {
          if (editingRuleIdx !== null) {
            updatedConditions[existingConditionIndex] = {
              ...updatedConditions[existingConditionIndex],
              ...newCondition
            };
          } else {
            const existingCondition = updatedConditions[existingConditionIndex];
            const mergedKeys = [...new Set([...existingCondition.keys, ...keys])];
            updatedConditions[existingConditionIndex] = {
              ...existingCondition,
              keys: mergedKeys
            };
          }
        } else {
          updatedConditions.push(newCondition);
        }

        newRules[existingRuleIndex] = {
          ...existingRule,
          conditions: updatedConditions,
          conditionMatchType: conditionMatchType
        };
      } else {
        newRule = {
          type: "payment",
          gateways,
          conditions: [newCondition],
          conditionMatchType: conditionMatchType
        };
        newRules.push(newRule);
      }
    }

    setFunctionRules(newRules);
    setEditingRuleIdx(null);
    setShowConditionForm(false);
    setConditionType("");
    setPaymentMode("country");
    setSelectedCountries([]);
    setZipCodeFields([""]);
    setSelectedGateways([]);
    setMinValue("");
    setMaxValue("");
    setOrderLimitValue("");
  };

  const handleMoveMinValue = () => {
    const newRule = { type: "minval", value: pendingMinValue };
    const newRules = [...functionRules];
    const minRuleIdx = functionRules.findIndex((r) => r.type === "minval");

    if (minRuleIdx !== -1 && editingRuleIdx === null) {
      newRules[minRuleIdx] = newRule;
    } else if (editingRuleIdx !== null) {
      newRules[editingRuleIdx] = newRule;
    } else {
      newRules.push(newRule);
    }

    const updatedAllFunctions = allFunctions.map(fn => {
      if (fn.id === existingMinValueFunction.id) {
        return {
          ...fn,
          rules: fn.rules.filter(rule => rule.type !== "minval")
        };
      } else if (fn.id === currentFunction.id) {
        return {
          ...fn,
          rules: newRules
        };
      }
      return fn;
    });


    fetcher.submit(
      {
        actionType: "moveMinValue",
        functions: JSON.stringify(updatedAllFunctions)
      },
      { method: "post" }
    );


    setFunctionRules(newRules);
    setShowMinValueModal(false);
    setEditingRuleIdx(null);
    setShowConditionForm(false);
    setConditionType("");
    setMinValue("");
    setPendingMinValue("");
  };

  const handleMoveOrderLimit = () => {
    const newRule = { type: "orderlimit", value: pendingOrderLimit };
    const newRules = [...functionRules];
    const orderRuleIdx = functionRules.findIndex((r) => r.type === "orderlimit");
    if (orderRuleIdx !== -1 && editingRuleIdx === null) {
      newRules[orderRuleIdx] = newRule;
    } else if (editingRuleIdx !== null) {
      newRules[editingRuleIdx] = newRule;
    } else {
      newRules.push(newRule);
    }

    const updatedAllFunctions = allFunctions.map(fn => {
      if (fn.id === existingOrderLimitFunction.id) {
        return {
          ...fn,
          rules: fn.rules.filter(rule => rule.type !== "orderlimit")
        };
      } else if (fn.id === currentFunction.id) {
        return {
          ...fn,
          rules: newRules
        };
      }
      return fn;
    });
    fetcher.submit(
      {
        actionType: "moveOrderLimit",
        functions: JSON.stringify(updatedAllFunctions)
      },
      { method: "post" }
    );
    setFunctionRules(newRules);
    setShowOrderLimitModal(false);
    setEditingRuleIdx(null);
    setShowConditionForm(false);
    setConditionType("");
    setOrderLimitValue("");
    setPendingOrderLimit("");
  };


  useEffect(() => {
    if (fetcher.data?.success) {
      setSuccessMessage("Minimum cart value condition moved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } else if (fetcher.data?.error) {
      setErrorMessage(fetcher.data.error);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  }, [fetcher.data]);

  const handleEditRule = (idx) => {
    const rule = functionRules[idx];
    setEditingRuleIdx(idx);

    if (rule.type === "minval" || rule.type === "orderlimit") {
      setShowConditionForm(true);
      setConditionType(rule.type);
      if (rule.type === "minval") setMinValue(rule.value);
      if (rule.type === "orderlimit") setOrderLimitValue(rule.value);
      setPaymentMode("country");
      setSelectedCountries([]);
      setZipCodeFields([""]);
      setSelectedGateways([]);
      setIncludeOrExclude("include");
      return;
    }

    if (rule.type === "payment") {
      setShowConditionForm(true);
      setConditionType("payment");
      setSelectedGateways(
        PAYMENT_GATEWAYS.filter((pg) =>
          (rule.gateways || []).includes(pg.label)
        ).map((pg) => pg.value)
      );

      setPaymentMode("country");
      setSelectedCountries([]);
      setZipCodeFields([""]);
      setMaxValue("");
      setIncludeOrExclude("include");
    }
  };

  const handleRemoveRule = (idx) => {
    setFunctionRules(functionRules.filter((_, i) => i !== idx));
    if (editingRuleIdx === idx) {
      setEditingRuleIdx(null);
      setShowConditionForm(false);
    }
  };

  const handleAddZipField = () => {
    setZipCodeFields([...zipCodeFields, ""]);
  };

  const handleRemoveZipField = (idx) => {
    setZipCodeFields(zipCodeFields.filter((_, i) => i !== idx));
  };

  const handleZipFieldChange = (idx, value) => {
    const updated = [...zipCodeFields];
    updated[idx] = value;
    setZipCodeFields(updated);
  };

  return (
    <Page
      title={currentFunction.title}
      backAction={{ content: 'Functions', url: '/app/settings' }}
      primaryAction={{
        content: 'Save Function',
        loading: navigation.state === "submitting",
        onAction: () => document.getElementById('function-form').requestSubmit(),
      }}
    >
      <BlockStack gap="400">
        {successMessage && (
          <Banner tone="success" onDismiss={() => setSuccessMessage("")}>
            {successMessage}
          </Banner>
        )}

        {errorMessage && (
          <Banner tone="critical" onDismiss={() => setErrorMessage("")}>
            {errorMessage}
          </Banner>
        )}

        <Modal
          open={showMinValueModal}
          onClose={() => setShowMinValueModal(false)}
          title="Minimum Cart Value Already Exists"
          primaryAction={{
            content: 'Move to This Function',
            onAction: handleMoveMinValue
          }}
          secondaryActions={[
            {
              content: 'Keep Existing',
              onAction: () => {
                setShowMinValueModal(false);
                setMinValue("");
                setPendingMinValue("");
              }
            }
          ]}
        >
          <Modal.Section>
            <p>
              A minimum cart value condition of {existingMinValueFunction?.rules?.find(r => r.type === "minval")?.value} {currency} already exists in function "{existingMinValueFunction?.title}".
              Would you like to move it to this function or keep it where it is?
            </p>
          </Modal.Section>
        </Modal>

        <Modal
          open={showOrderLimitModal}
          onClose={() => setShowOrderLimitModal(false)}
          title="Order Limit Already Exists"
          primaryAction={{
            content: 'Move to This Function',
            onAction: handleMoveOrderLimit
          }}
          secondaryActions={[
            {
              content: 'Keep Existing',
              onAction: () => {
                setShowOrderLimitModal(false);
                setOrderLimitValue("");
                setPendingOrderLimit("");
              }
            }
          ]}
        >
          <Modal.Section>
            <p>
              An order limit condition of {existingOrderLimitFunction?.rules?.find(r => r.type === "orderlimit")?.value} already exists in function "{existingOrderLimitFunction?.title}".
              Would you like to move it to this function or keep it where it is?
            </p>
          </Modal.Section>
        </Modal>

        <Form
          method="post"
          action={`/app/settings/${currentFunction.id}`}
          id="function-form"
        >
          <input type="hidden" name="functionId" value={currentFunction.id} />
          <input
            type="hidden"
            name="functions"
            value={JSON.stringify({
              id: currentFunction.id,
              title: currentFunction.title,
              rules: functionRules,
              enabled: isEnabled
            })}
          />

          {functionRules.length > 0 && (
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Conditions:</Text>
              <div style={{ margin: '16px 0 24px 0' }}>
                {!showConditionForm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <Button
                      onClick={() => {
                        setShowConditionForm(true);
                        setConditionType("minval");
                        setEditingRuleIdx(null);
                      }}
                      primary
                    >
                      Add Condition
                    </Button>
                    <Checkbox
                      label="Enable this validation function"
                      checked={isEnabled}
                      onChange={setIsEnabled}
                      toggle
                    />
                  </div>
                ) : (
                  <Card sectioned>
                    <BlockStack gap="400">
                      <Select
                        label="Condition Type"
                        options={CONDITION_OPTIONS}
                        value={conditionType}
                        onChange={setConditionType}
                      />
                      {conditionType === "minval" && (
                        <TextField
                          label="Minimum Cart Value"
                          type="number"
                          value={minValue}
                          onChange={setMinValue}
                          autoComplete="off"
                          prefix={currency}
                        />
                      )}
                      {conditionType === "orderlimit" && (
                        <TextField
                          label="Order Limit"
                          type="number"
                          value={orderLimitValue}
                          onChange={setOrderLimitValue}
                          autoComplete="off"
                        />
                      )}
                      {conditionType === "payment" && (
                        <>
                          <InlineStack gap="400" align="start">
                            <div style={{ flex: 1 }}>
                              <Select
                                label="Block by"
                                options={[
                                  { label: "Country", value: "country" },
                                  { label: "Zip Code", value: "zip" },
                                  { label: "Max Cart Value", value: "max_cart_value" }
                                ]}
                                value={paymentMode}
                                onChange={setPaymentMode}
                              />
                            </div>
                            {(paymentMode === "country" || paymentMode === "zip") && (
                              <div style={{ flex: 1 }}>
                                <Select
                                  label="Apply to"
                                  options={[
                                    { label: "Only these", value: "include" },
                                    { label: "All except these", value: "exclude" }
                                  ]}
                                  value={includeOrExclude}
                                  onChange={setIncludeOrExclude}
                                />
                              </div>
                            )}
                          </InlineStack>

                          <InlineStack gap="400" align="start">
                            {paymentMode === "country" && (
                              <div style={{ flex: 1 }}>
                                <Autocomplete
                                  allowMultiple
                                  options={countryOptionsForAutocomplete.filter(opt =>
                                    opt.label.toLowerCase().includes(countrySearch.toLowerCase())
                                  )}
                                  selected={selectedCountries}
                                  onSelect={setSelectedCountries}
                                  textField={
                                    <Autocomplete.TextField
                                      label="Select Countries"
                                      value={countrySearch}
                                      onChange={setCountrySearch}
                                      placeholder="Search countries"
                                      autoComplete="off"
                                      verticalContent={renderSelectedTags(selectedCountries, countryOptionsForAutocomplete, (val) => {
                                        setSelectedCountries(selectedCountries.filter((v) => v !== val));
                                      })}
                                    />
                                  }
                                />
                              </div>
                            )}
                            {paymentMode === "zip" && (
                              <div style={{ flex: 1 }}>
                                {zipCodeFields.map((field, zidx) => (
                                  <InlineStack key={zidx} blockAlign="center" gap="200" style={{ marginBottom: 8 }}>
                                    <div style={{ width: '500px' }}>
                                      <TextField
                                        label={zidx === 0 ? "Enter Zip Codes (comma separated)" : ""}
                                        value={field}
                                        onChange={value => handleZipFieldChange(zidx, value)}
                                        multiline={5}
                                        maxLength={10000}
                                        autoComplete="off"
                                        helpText={`${field.length}/10000 characters`}
                                        connectedRight={
                                          <>
                                            <Button onClick={handleAddZipField}>+</Button>
                                            {zipCodeFields.length > 1 && (
                                              <Button onClick={() => handleRemoveZipField(zidx)} tone="critical">-</Button>
                                            )}
                                          </>
                                        }
                                      />
                                    </div>
                                  </InlineStack>
                                ))}
                                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                                  You can enter multiple zip codes separated by commas
                                </div>
                              </div>
                            )}
                            {paymentMode === "max_cart_value" && (
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Enter Maximum Cart Value"
                                  type="number"
                                  value={maxValue}
                                  onChange={setMaxValue}
                                  autoComplete="off"
                                  placeholder="Enter maximum cart value"
                                />
                              </div>
                            )}
                            <div style={{ flex: 1 }}>
                              <Autocomplete
                                allowMultiple
                                options={paymentGatewayOptions.filter(opt =>
                                  opt.label.toLowerCase().includes(gatewaySearch.toLowerCase())
                                )}
                                selected={selectedGateways}
                                onSelect={setSelectedGateways}
                                textField={
                                  <Autocomplete.TextField
                                    label="Select Payment Gateways to Block"
                                    value={gatewaySearch}
                                    onChange={setGatewaySearch}
                                    placeholder="Search gateways"
                                    autoComplete="off"
                                    verticalContent={renderSelectedTags(selectedGateways, paymentGatewayOptions, (val) => {
                                      setSelectedGateways(selectedGateways.filter((v) => v !== val));
                                    })}
                                  />
                                }
                              />
                            </div>
                          </InlineStack>
                        </>
                      )}
                      <InlineStack gap="200">
                        <Button
                          onClick={handleAddOrUpdateRule}
                          primary
                          disabled={
                            (conditionType === "minval" && !minValue) ||
                            (conditionType === "maxval" && !maxValue) ||
                            (conditionType === "orderlimit" && !orderLimitValue) ||
                            (conditionType === "payment" &&
                              ((paymentMode === "country"
                                ? selectedCountries.length === 0 && (!editingRuleIdx && (!functionRules[editingRuleIdx]?.conditions?.[editingRuleIdx]?.keys?.length))
                                : paymentMode === "max_cart_value"
                                  ? !maxValue || selectedGateways.length === 0
                                  : zipCodeFields.every((z) => !z.trim()))))
                          }
                        >
                          {editingRuleIdx !== null ? "Update Condition" : "Add Condition"}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowConditionForm(false);
                            setEditingRuleIdx(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                )}
              </div>
              {functionRules.map((rule, idx) => (
                <div key={idx}>
                  <Card sectioned>
                    <span>
                      {rule.type === "minval" && (
                        <>
                          <b>Minimum Cart Value: {rule.value} {currency}</b>
                          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 12 }}>
                            <Button size="slim" onClick={() => handleEditRule(idx)}>
                              Edit
                            </Button>
                            <Button size="slim" destructive onClick={() => handleRemoveRule(idx)}>
                              Remove
                            </Button>
                          </span>
                        </>
                      )}
                      {rule.type === "maxval" && (
                        <b>Maximum Cart Value: {rule.value} {currency}</b>
                      )}
                      {rule.type === "orderlimit" && (
                        <>
                          <b>Order Limit: {rule.value}</b>
                          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 12 }}>
                            <Button size="slim" onClick={() => handleEditRule(idx)}>
                              Edit
                            </Button>
                            <Button size="slim" destructive onClick={() => handleRemoveRule(idx)}>
                              Remove
                            </Button>
                          </span>
                        </>
                      )}
                      {rule.type === "payment" && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <b>Payment Gateways:</b>{" "}
                            <span>
                              {(() => {
                                const gatewayLabels = (rule.gateways || []).map(gwName => {
                                  const icon = PAYMENT_GATEWAYS.find(pg => pg.label === gwName)?.icon;
                                  return (icon ? icon + " " : "") + gwName;
                                });
                                const maxToShow = 3;
                                if (gatewayLabels.length > maxToShow) {
                                  return gatewayLabels.slice(0, maxToShow).join(", ") + ", ...";
                                } else {
                                  return gatewayLabels.join(", ");
                                }
                              })()}
                            </span>
                            <Button size="slim" onClick={() => handleEditRule(idx)}>
                              Edit
                            </Button>
                            <Button size="slim" destructive onClick={() => handleRemoveRule(idx)}>
                              Remove
                            </Button>
                          </div>
                          <br />
                          <b>Blocking Conditions:</b>
                          <div style={{ marginLeft: 16, marginTop: 8 }}>
                            <Select
                              label="Condition Matching"
                              options={[
                                { label: "All conditions must be met", value: "all" },
                                { label: "Any of these conditions", value: "any" }
                              ]}
                              value={rule.conditionMatchType || "all"}
                              onChange={(value) => {
                                const newRules = [...functionRules];
                                const ruleIndex = functionRules.findIndex(r => r === rule);
                                if (ruleIndex !== -1) {
                                  newRules[ruleIndex] = {
                                    ...rule,
                                    conditionMatchType: value
                                  };
                                  setFunctionRules(newRules);
                                }
                              }}
                            />
                          </div>
                          {(rule.conditions || []).map((condition, condIdx) => (
                            <div key={condIdx} style={{ marginLeft: 16, marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span>
                                  {condition.mode === "country" && (
                                    <>
                                      <b>
                                        {condition.include === false
                                          ? "All countries except:"
                                          : "Only these countries:"}
                                      </b>{" "}
                                      {(() => {
                                        const countryLabels = (condition.keys || []).map((k) => {
                                          const opt = countryOptions.find((c) => c.value === k);
                                          const FlagIcon = Flags[k];
                                          return (
                                            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>
                                              {FlagIcon && <FlagIcon style={{ width: 20, height: 14, marginRight: 4, verticalAlign: 'middle' }} />}
                                              {opt?.label || k}
                                            </span>
                                          );
                                        });
                                        const maxToShow = 3;
                                        if (countryLabels.length > maxToShow) {
                                          return (
                                            <>
                                              {countryLabels.slice(0, maxToShow)}
                                              , ...
                                            </>
                                          );
                                        } else {
                                          return countryLabels;
                                        }
                                      })()}
                                    </>
                                  )}
                                  {condition.mode === "zip" && (
                                    <>
                                      <b>
                                        {condition.include === false
                                          ? "All zip codes except:"
                                          : "Only these zip codes:"}
                                      </b>{" "}
                                      {(() => {
                                        const zipString = (condition.keys || []).join(", ");
                                        return zipString.length > 50
                                          ? zipString.slice(0, 50) + '...'
                                          : zipString;
                                      })()}
                                    </>
                                  )}
                                  {condition.mode === "max_cart_value" && (
                                    <>
                                      <b>Maximum Cart Value:</b> {condition.keys[0]} {currency}
                                    </>
                                  )}
                                </span>
                                <Button size="slim" onClick={() => handleEditCondition(idx, condIdx)}>
                                  Edit
                                </Button>
                                <Button size="slim" destructive onClick={() => handleRemoveCondition(idx, condIdx)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div style={{ marginTop: 8 }}>
                            <Button size="slim" onClick={() => handleAddCondition(idx)}>
                              Add Another Condition
                            </Button>
                          </div>
                        </>
                      )}
                    </span>
                  </Card>
                </div>
              ))}
            </BlockStack>
          )}

          {functionRules.length === 0 && !showConditionForm && (
            <div style={{ margin: '16px 0 24px 0', display: 'flex', alignItems: 'center', gap: 24 }}>
              <Button
                onClick={() => {
                  setShowConditionForm(true);
                  setConditionType("minval");
                }}
                primary
              >
                Add Condition
              </Button>
              <Checkbox
                label="Enable this validation function"
                checked={isEnabled}
                onChange={setIsEnabled}
                toggle
              />
            </div>
          )}

          {functionRules.length === 0 && showConditionForm && (
            <Card sectioned style={{ marginTop: 16 }}>
              <BlockStack gap="400">
                <Select
                  label="Condition Type"
                  options={CONDITION_OPTIONS}
                  value={conditionType}
                  onChange={setConditionType}
                />
                {conditionType === "minval" && (
                  <TextField
                    label="Minimum Cart Value"
                    type="number"
                    value={minValue}
                    onChange={setMinValue}
                    autoComplete="off"
                    prefix={currency}
                  />
                )}
                {conditionType === "orderlimit" && (
                  <TextField
                    label="Order Limit"
                    type="number"
                    value={orderLimitValue}
                    onChange={setOrderLimitValue}
                    autoComplete="off"
                  />
                )}
                {conditionType === "payment" && (
                  <>
                    <InlineStack gap="400" align="start">
                      <div style={{ flex: 1 }}>
                        <Select
                          label="Block by"
                          options={[
                            { label: "Country", value: "country" },
                            { label: "Zip Code", value: "zip" },
                            { label: "Max Cart Value", value: "max_cart_value" }
                          ]}
                          value={paymentMode}
                          onChange={setPaymentMode}
                        />
                      </div>
                      {(paymentMode === "country" || paymentMode === "zip") && (
                        <div style={{ flex: 1 }}>
                          <Select
                            label="Apply to"
                            options={[
                              { label: "Only these", value: "include" },
                              { label: "All except these", value: "exclude" }
                            ]}
                            value={includeOrExclude}
                            onChange={setIncludeOrExclude}
                          />
                        </div>
                      )}
                    </InlineStack>

                    <InlineStack gap="400" align="start">
                      {paymentMode === "country" && (
                        <div style={{ flex: 1 }}>
                          <Autocomplete
                            allowMultiple
                            options={countryOptionsForAutocomplete.filter(opt =>
                              opt.label.toLowerCase().includes(countrySearch.toLowerCase())
                            )}
                            selected={selectedCountries}
                            onSelect={setSelectedCountries}
                            textField={
                              <Autocomplete.TextField
                                label="Select Countries"
                                value={countrySearch}
                                onChange={setCountrySearch}
                                placeholder="Search countries"
                                autoComplete="off"
                                verticalContent={renderSelectedTags(selectedCountries, countryOptionsForAutocomplete, (val) => {
                                  setSelectedCountries(selectedCountries.filter((v) => v !== val));
                                })}
                              />
                            }
                          />
                        </div>
                      )}
                      {paymentMode === "zip" && (
                        <div style={{ flex: 1 }}>
                          {zipCodeFields.map((field, zidx) => (
                            <InlineStack key={zidx} blockAlign="center" gap="200" style={{ marginBottom: 8 }}>
                              <div style={{ width: '500px' }}>
                                <TextField
                                  label={zidx === 0 ? "Enter Zip Codes (comma separated)" : ""}
                                  value={field}
                                  onChange={value => handleZipFieldChange(zidx, value)}
                                  multiline={5}
                                  maxLength={10000}
                                  autoComplete="off"
                                  helpText={`${field.length}/10000 characters`}
                                  connectedRight={
                                    <>
                                      <Button onClick={handleAddZipField}>+</Button>
                                      {zipCodeFields.length > 1 && (
                                        <Button onClick={() => handleRemoveZipField(zidx)} tone="critical">-</Button>
                                      )}
                                    </>
                                  }
                                />
                              </div>
                            </InlineStack>
                          ))}
                          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                            You can enter multiple zip codes separated by commas
                          </div>
                        </div>
                      )}
                      {paymentMode === "max_cart_value" && (
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="Enter Maximum Cart Value"
                            type="number"
                            value={maxValue}
                            onChange={setMaxValue}
                            autoComplete="off"
                            placeholder="Enter maximum cart value"
                          />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <Autocomplete
                          allowMultiple
                          options={paymentGatewayOptions.filter(opt =>
                            opt.label.toLowerCase().includes(gatewaySearch.toLowerCase())
                          )}
                          selected={selectedGateways}
                          onSelect={setSelectedGateways}
                          textField={
                            <Autocomplete.TextField
                              label="Select Payment Gateways to Block"
                              value={gatewaySearch}
                              onChange={setGatewaySearch}
                              placeholder="Search gateways"
                              autoComplete="off"
                              verticalContent={renderSelectedTags(selectedGateways, paymentGatewayOptions, (val) => {
                                setSelectedGateways(selectedGateways.filter((v) => v !== val));
                              })}
                            />
                          }
                        />
                      </div>
                    </InlineStack>
                  </>
                )}
                <InlineStack gap="200">
                  <Button
                    onClick={handleAddOrUpdateRule}
                    primary
                    disabled={
                      (conditionType === "minval" && !minValue) ||
                      (conditionType === "maxval" && !maxValue) ||
                      (conditionType === "orderlimit" && !orderLimitValue) ||
                      (conditionType === "payment" &&
                        ((paymentMode === "country"
                          ? selectedCountries.length === 0 && (!editingRuleIdx && (!functionRules[editingRuleIdx]?.conditions?.[editingRuleIdx]?.keys?.length))
                          : paymentMode === "max_cart_value"
                            ? !maxValue || selectedGateways.length === 0
                            : zipCodeFields.every((z) => !z.trim()))))
                    }
                  >
                    {editingRuleIdx !== null ? "Update Condition" : "Add Condition"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowConditionForm(false);
                      setEditingRuleIdx(null);
                    }}
                  >
                    Cancel
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}
        </Form>
      </BlockStack>
    </Page>
  );
}