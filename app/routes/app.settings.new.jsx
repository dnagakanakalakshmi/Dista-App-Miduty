import { Form, useNavigation, useActionData } from "@remix-run/react";
import { Card, TextField, Button, InlineStack, BlockStack, Text, Banner, Spinner } from "@shopify/polaris";
import { useState, useRef, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const functionTitle = formData.get("functionTitle");

  if (!functionTitle) {
    return json({ error: "Function title is required" }, { status: 400 });
  }

  // Create new function with proper structure
  const newFunction = {
    id: `fn_${Date.now()}`,
    title: functionTitle.trim(),
    rules: [],
    enabled: false
  };

  // Get shop ID
  const shopInfo = await admin.graphql(`query { shop { id } }`);
  const shop = (await shopInfo.json()).data.shop;

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
  let existing = [];

  try {
    existing = data.data.shop.validationFunctions?.value
      ? JSON.parse(data.data.shop.validationFunctions.value)
      : [];
  } catch (error) {
    console.error("Error parsing functions:", error);
  }

  // Add new function
  // Check for duplicate function title
  const duplicate = existing.some(
    fn => fn.title.trim().toLowerCase() === functionTitle.trim().toLowerCase()
  );
  if (duplicate) {
    return json({ error: "A function with this name already exists." }, { status: 400 });
  }

  // Add new function
  const updated = [...existing, newFunction];

  // Correct JSON string for GraphQL
  const jsonString = JSON.stringify(updated);

  // Save
  const result = await admin.graphql(`
    mutation {
      metafieldsSet(metafields: [{
        namespace: "cart_validation",
        key: "validation_functions",
        type: "json",
        value: "${jsonString.replace(/"/g, '\\"')}",
        ownerId: "${shop.id}"
      }]) {
        metafields { id }
      }
    }
  `);


  return redirect(`/app/settings/${newFunction.id}`);
};

export default function NewFunctionForm() {
  const [title, setTitle] = useState("");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const actionData = useActionData();
  const [redirecting, setRedirecting] = useState(false);
  const wasSubmitting = useRef(false);

  useEffect(() => {
    // When submission finishes and there is no error, show redirecting spinner
    if (wasSubmitting.current && !isSubmitting && !actionData?.error) {
      setRedirecting(true);
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting, actionData]);

  return (
    <div style={{ margin: '32px', position: 'relative' }}>
      {(isSubmitting || redirecting) && (
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
          <Spinner accessibilityLabel={isSubmitting ? "Creating function" : "Redirecting..."} size="large" />
        </div>
      )}
      <Card>
        <Form method="post">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Create New Function</Text>

            {actionData?.error && (
              <Banner tone="critical">{actionData.error}</Banner>
            )}

            {navigation.formData?.get("actionType") === "saveFunction" && navigation.state === "idle" && navigation.formErrors && (
              <Banner tone="critical">{navigation.formErrors.error}</Banner>
            )}

            <TextField
              label="Function Title"
              value={title}
              onChange={setTitle}
              autoComplete="off"
              required
              name="functionTitle"
            />

            <InlineStack gap="200">
              <Button submit primary>
                Save Function
              </Button>
              <Button url="/app/settings">Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Form>
      </Card>
    </div>
  );
}