import { Outlet, redirect } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";


export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveFunction") {
    const functionTitle = formData.get("functionTitle");
    if (!functionTitle) {
      return json({ error: "Function title is required" }, { status: 400 });
    }

    const shopInfo = await admin.graphql(`query { shop { id } }`);
    const shop = (await shopInfo.json()).data.shop;

    const newFunction = {
      id: `fn_${Date.now()}`,
      title: functionTitle,
      rules: [],
      enabled: false
    };

    // Get existing functions
    const functionsResponse = await admin.graphql(`
      query {
        shop {
          validationFunctions: metafield(
            namespace: "cart_validation", 
            key: "validation_functions"
          ) { value }
        }
      }
    `);
    
    const functionsData = await functionsResponse.json();
    const existingFunctions = functionsData.data.shop.validationFunctions?.value
        ? JSON.parse(functionsData.data.shop.validationFunctions.value)
        : [];

    const updatedFunctions = [...existingFunctions, newFunction];

    // Save updated functions
    const result = await admin.graphql(`
      mutation {
        metafieldsSet(metafields: [{
          namespace: "cart_validation",
          key: "validation_functions",
          type: "json",
          value: ${JSON.stringify(updatedFunctions)},
          ownerId: "${shop.id}"
        }]) {
          metafields { id }
          userErrors { field message }
        }
      }
    `);

    const resultJson = await result.json();
    if (resultJson.errors) {
      return json({ error: "Failed to save function" }, { status: 500 });
    }

    return redirect(`/app/settings/${newFunction.id}`);
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function SettingsLayout() {
  return <Outlet />;
}
