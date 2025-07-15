// app.settings._index.jsx
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Card, Text, List, Button, BlockStack, IndexTable, Tag, Checkbox, Spinner, Modal, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        id
        currencyCode
        plan {
          displayName
          partnerDevelopment
          shopifyPlus
        }
        validationFunctions: metafield(
          namespace: "cart_validation", 
          key: "validation_functions"
        ) { 
          id
          value 
        }
        enabledMetafield: metafield(namespace: "cart_validation", key: "enabled") { value }
      }
    }
  `);

  const data = await response.json();
  const shop = data.data.shop;

  let functions = [];
  try {
    const raw = shop.validationFunctions?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      functions = Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error("Error parsing functions:", error);
    functions = [];
  }

  // Check if store is Plus organization
  const isPlusStore = shop.plan?.shopifyPlus || shop.plan?.partnerDevelopment;

  return json({
    currency: shop.currencyCode,
    functions: functions || [],
    enabled: shop.enabledMetafield?.value === "true",  // Return the parsed array
    isPlusStore: isPlusStore,
    planName: shop.plan?.displayName || 'Unknown',
    // ... other data
  }, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const functionId = formData.get("functionId");
  const funId = "8814cf17-072c-48f7-b7e3-01fe3388f7c7";
  const payId = "d8775fe2-9295-432d-8c72-167cac4e5ef3";

  if (actionType === "toggleEnabled") {
    const enabled = formData.get("enabled") === "true";
    // Save the enabled state to the metafield
    const shopIdResponse = await admin.graphql(`query { shop { id } }`);
    const shopId = (await shopIdResponse.json()).data.shop.id;
    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [{
          namespace: "cart_validation",
          key: "enabled",
          type: "single_line_text_field",
          value: "${enabled}",
          ownerId: "${shopId}"
        }]) {
          metafields { id }
          userErrors { field message }
        }
      }
    `);
    const checkExistingQuery = `
      query {
        validations(first: 100) {
          edges {
            node {
              id
              title
              enabled
              shopifyFunction {
                id
              }
            }
          }
        }
      }
    `;
    const existingValidations = await admin.graphql(checkExistingQuery);
    const existingValidationsJson = await existingValidations.json();
    const validationEdge = existingValidationsJson.data.validations.edges.find(
      edge => edge.node.shopifyFunction.id === funId
    );

 const paymentCustomizationQuery = `
  query {
  paymentCustomizations(first: 10) {
    edges {
      node {
        id
        title
        enabled
        functionId
      }
    }
  }
}
`;
const paymentCustomizationsResp = await admin.graphql(paymentCustomizationQuery);
const paymentCustomizationsData = await paymentCustomizationsResp.json();
const paymentCustomization = paymentCustomizationsData.data.paymentCustomizations.edges.find(
  edge => edge.node.functionId === payId
);
   
    if (enabled) {
      if (!validationEdge) {
        const createValidationMutation = `
          mutation {
            validationCreate(
              validation: {
                functionId: "${funId}"
                enable: true
                blockOnFailure: true
                title: "MCV-Validation"
              }
            ) {
              validation {
                id
                title
                enabled
                blockOnFailure
              }
              userErrors {
                field
                message
                code
              }
            }
          }
        `;
        await admin.graphql(createValidationMutation);

      } else if (!validationEdge.node.enabled) {
        const enableMutation = `
          mutation {
            validationUpdate(
              id: "${validationEdge.node.id}"
              validation: { enable: true }
            ) {
              validation {
                id
                enabled
              }
              userErrors {
                field
                message
                code
              }
            }
          }
        `;
        await admin.graphql(enableMutation);
      }
      if (!paymentCustomization) {
    // Create new
    const createPaymentCustomizationMutation = `
      mutation {
        paymentCustomizationCreate(paymentCustomization: {
          title: "Hide payment method by cart total",
          enabled: true,
          functionId: "${payId}"
        }) {
          paymentCustomization { id enabled }
          userErrors { message }
        }
      }
    `;
    await admin.graphql(createPaymentCustomizationMutation);
  } else {
    // Enable existing
    const enablePaymentCustomizationMutation = `
      mutation {
        paymentCustomizationUpdate(
          id: "${paymentCustomization.node.id}",
          paymentCustomization: { enabled: true }
        ) {
          paymentCustomization { id enabled }
          userErrors { message }
        }
      }
    `;
    await admin.graphql(enablePaymentCustomizationMutation);
  }
    } else {
      if (validationEdge && validationEdge.node.enabled) {
        const disableMutation = `
          mutation {
            validationUpdate(
              id: "${validationEdge.node.id}"
              validation: { enable: false }
            ) {
              validation {
                id
                enabled
              }
              userErrors {
                field
                message
                code
              }
            }
          }
        `;
        await admin.graphql(disableMutation);
      }
      // Disable if exists
  if (paymentCustomization) {
    const disablePaymentCustomizationMutation = `
      mutation {
        paymentCustomizationUpdate(
          id: "${paymentCustomization.node.id}",
          paymentCustomization: { enabled: false }
        ) {
          paymentCustomization { id enabled }
          userErrors { message }
        }
      }
    `;
    await admin.graphql(disablePaymentCustomizationMutation);
    }
    }
    return json({ enabled });
  }

  if (actionType === "deleteFunction" && functionId) {
    // Get existing functions
    const response = await admin.graphql(`
      query {
        shop {
          id
          validationFunctions: metafield(
            namespace: "cart_validation",
            key: "validation_functions"
          ) { value }
        }
      }
    `);
    const data = await response.json();
    console.log('dataaa',data);
    let functions = [];
    try {
      functions = data.data.shop.validationFunctions?.value
        ? JSON.parse(data.data.shop.validationFunctions.value)
        : [];
    } catch (error) {
      console.error("Error parsing functions:", error);
    }
    // Remove the function
    const updatedFunctions = functions.filter(fn => fn.id !== functionId);
    // Save updated functions
    await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [{
          namespace: "cart_validation",
          key: "validation_functions",
          type: "json",
          value: ${JSON.stringify(JSON.stringify(updatedFunctions))},
          ownerId: "${data.data.shop.id}"
        }]) {
          metafields { id }
          userErrors { field message }
        }
      }
    `);
    return json({ success: true });
  }
  return json({ error: "Invalid action" }, { status: 400 });
};

export default function FunctionsList() {
  const loaderData = useLoaderData();
  const functions = Array.isArray(loaderData?.functions) ? loaderData.functions : [];
  const [isEnabled, setIsEnabled] = useState(loaderData.enabled);
  const [loading, setLoading] = useState(false);
  const [showPlusPopup, setShowPlusPopup] = useState(false);
  const fetcher = useFetcher();
  
  useEffect(() => {
    if (typeof fetcher.data?.enabled === "boolean") setIsEnabled(fetcher.data.enabled);
  }, [fetcher.data]);

  const handleToggleEnabled = (checked) => {
    if (!loaderData.isPlusStore) {
      setShowPlusPopup(true);
      return;
    }
    
    fetcher.submit(
      {
        actionType: "toggleEnabled",
        enabled: checked ? "true" : "false"
      },
      { method: "post" }
    );
  };

  const handleAddFunction = () => {
    if (!loaderData.isPlusStore) {
      setShowPlusPopup(true);
      return;
    }
    // Navigate to new function page
    window.location.href = '/app/settings/new';
  };

  const handleEditFunction = (functionId) => {
    if (!loaderData.isPlusStore) {
      setShowPlusPopup(true);
      return;
    }
    setLoading(true);
    window.location.href = `/app/settings/${functionId}`;
  };

  const handleDeleteFunction = (e, functionId) => {
    if (!loaderData.isPlusStore) {
      e.preventDefault();
      setShowPlusPopup(true);
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this function?')) {
      e.preventDefault();
    }
  };

  return (
    <div style={{ margin: '32px', position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(255,255,255,0.7)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Spinner accessibilityLabel="Loading function" size="large" />
        </div>
      )}
      
      {/* Plus Store Required Popup */}
      <Modal
        open={showPlusPopup}
        onClose={() => setShowPlusPopup(false)}
        title="Shopify Plus Required"
        primaryAction={{
          content: 'Learn More',
          onAction: () => {
            window.open('https://www.shopify.com/plus', '_blank');
            setShowPlusPopup(false);
          },
        }}
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setShowPlusPopup(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              Checkout Validations are only available for <strong>Shopify Plus</strong> stores.
            </Text>
            <Text as="p" color="subdued">
              Your current plan is: <strong>{loaderData.planName}</strong>
            </Text>
            <Text as="p" color="subdued">
              To use this feature, you'll need to upgrade to Shopify Plus. Shopify Plus provides advanced features including:
            </Text>
            <ul style={{ margin: '8px 0 8px 24px', padding: 0 }}>
              <li>Custom checkout validations</li>
              <li>Advanced payment customizations</li>
              <li>Enhanced automation capabilities</li>
              <li>Priority support</li>
            </ul>
            <Text as="p" color="subdued">
              Contact Shopify to learn more about upgrading to Plus.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Card>
        <BlockStack gap="400">
          {/* Title and Enable Checkout Rule checkbox in one row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text as="h2" variant="headingMd">Validation Functions</Text>
            <Checkbox
              label="Enable Checkout Rule"
              checked={isEnabled}
              onChange={handleToggleEnabled}
              toggle
              disabled={!loaderData.isPlusStore}
            />
          </div>

          {!loaderData.isPlusStore && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <Text as="p" color="subdued" style={{ margin: 0 }}>
                ⚠️ <strong>Shopify Plus Required:</strong> This feature is only available for Shopify Plus stores. 
                Your current plan is <strong>{loaderData.planName}</strong>.
              </Text>
            </div>
          )}

          {functions.length === 0 ? (
            <>
              <div style={{ padding: '8px 0', margin: '4px 0' }}>
                <Text as="h3" variant="headingSm" style={{ marginBottom: 8 }}>
                  What are Checkout Validations?
                </Text>
                <Text as="p" color="subdued" style={{ marginBottom: 12 }}>
                  Checkout Validations let you create custom rules for your Shopify store's checkout process. You can:
                  <ul style={{ margin: '8px 0 8px 24px', padding: 0 }}>
                    <li>Fix a minimum cart value to place an order</li>
                    <li>Set a maximum number of items per order</li>
                    <li>Restrict or hide payment methods based on country, zip code, or cart value</li>
                  </ul>
                  <br />
                  To get started, click <b>Add Function</b> below and define your first validation rule. Each function can have one or more conditions, and you can enable or disable them at any time.
                </Text>
              </div>
              <Text as="p">No functions created yet. Click "Add Function" to create one.</Text>
              <Button onClick={handleAddFunction} primary disabled={!loaderData.isPlusStore}>
                Add Function
              </Button>
            </>
          ) : (
            <>
            <IndexTable
              itemCount={functions.length}
              headings={[
                { title: 'Function Name' },
                { title: 'Status' },
                { title: 'Conditions' },
                { title: 'Actions' }
              ]}
              selectable={false}
            >
              {functions.map((fn, index) => (
                <IndexTable.Row id={fn.id} key={fn.id} position={index}>
                  <IndexTable.Cell>
                    <Link
                      to={`/app/settings/${fn.id}`}
                      style={{
                        color: '#111827', // black-ish
                        textDecoration: 'none',
                        fontWeight: 500,
                        fontSize: 15,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        padding: 0,
                        minHeight: 0,
                        minWidth: 0,
                        display: 'inline-block',
                        pointerEvents: loading ? 'none' : 'auto',
                      }}
                      onClick={e => {
                        if (!loaderData.isPlusStore) {
                          e.preventDefault();
                          setShowPlusPopup(true);
                          return;
                        }
                        setLoading(true);
                      }}
                    >
                      {fn.title}
                    </Link>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {fn.enabled ? (
                      <span
                        style={{
                          background: '#C6F6D5', // light green
                          color: '#256029', // dark green text
                          borderRadius: 16,
                          padding: '4px 18px',
                          fontWeight: 600,
                          fontSize: 12,
                          display: 'inline-block',
                          minWidth: 70,
                          textAlign: 'center',
                          lineHeight: 1.5,
                        }}
                      >
                        Enabled
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#E5E7EB', // gray-200
                          color: '#374151', // gray-700
                          borderRadius: 16,
                          padding: '4px 18px',
                          fontWeight: 600,
                          fontSize: 12,
                          display: 'inline-block',
                          minWidth: 70,
                          textAlign: 'center',
                          lineHeight: 1.5,
                        }}
                      >
                        Disabled
                      </span>
                    )}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {fn.rules?.length || 0} conditions
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button 
                        onClick={() => handleEditFunction(fn.id)} 
                        disabled={loading || !loaderData.isPlusStore}
                      >
                        Edit
                      </Button>
                      <fetcher.Form method="post" style={{ display: 'inline' }}>
                        <input type="hidden" name="actionType" value="deleteFunction" />
                        <input type="hidden" name="functionId" value={fn.id} />
                        <Button
                          tone="critical"
                          onClick={(e) => handleDeleteFunction(e, fn.id)}
                          submit
                          size="slim"
                          disabled={!loaderData.isPlusStore}
                        >
                          Delete
                        </Button>
                      </fetcher.Form>
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            <Button onClick={handleAddFunction} primary style={{ marginTop: 24 }} disabled={!loaderData.isPlusStore}>
              Add Function
            </Button>
            </>
          )}
        </BlockStack>
      </Card>
    </div>
  );
}