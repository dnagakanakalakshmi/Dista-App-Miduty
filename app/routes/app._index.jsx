import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Dista App: Recently Viewed, Ordered & Checkout Rules" />

      <Layout>
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text as="h1" variant="headingXl">
                Welcome to Dista App
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                Supercharge your Shopify store with personalized shopping experiences and advanced checkout controls. Easily add <b>Recently Viewed</b> and <b>Recently Ordered</b> product sections, and enforce <b>checkout validation & payment rules</b>—all from one app.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Recently Viewed Products" sectioned>
            <Text as="p">
              Show your customers the products they've recently browsed, right on your storefront. This dynamic section helps shoppers rediscover items and increases conversion rates.
            </Text>
            <List type="bullet">
              <List.Item>Works for both logged-in and guest users</List.Item>
              <List.Item>Customizable carousel or grid layout</List.Item>
              <List.Item>"Add to Cart" and "Buy Now" buttons for quick action</List.Item>
              <List.Item>Easy drag-and-drop placement via Shopify Theme Editor</List.Item>
            </List>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Recently Ordered Products" sectioned>
            <Text as="p">
              Let customers quickly reorder their favorite products! Display a section of items they've purchased before, typically on account or thank you pages.
            </Text>
            <List type="bullet">
              <List.Item>Shows order history for logged-in customers</List.Item>
              <List.Item>"Reorder" and "Add to Cart" buttons for convenience</List.Item>
              <List.Item>Customizable display and styling</List.Item>
              <List.Item>Embed anywhere using the Theme Editor</List.Item>
            </List>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Checkout Validation & Payment Rules" sectioned>
            <Text as="p">
              Take control of your checkout! Define rules to enforce minimum cart values, order quantity limits, and dynamically hide payment gateways based on country, zip code, or cart value.
            </Text>
            <List type="bullet">
              <List.Item>Set a <b>Minimum Cart Value</b> to proceed to checkout</List.Item>
              <List.Item>Limit the <b>maximum number of items</b> per order</List.Item>
              <List.Item>Hide payment gateways by <b>country, zip code, or cart value</b></List.Item>
              <List.Item>All rules are enforced in real-time at checkout using Shopify Functions</List.Item>
              <List.Item>Manage all rules in a simple, visual admin interface</List.Item>
            </List>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="How to Get Started" sectioned>
            <BlockStack gap="200">
              <Banner status="info">
                <Text as="span">
                  <b>Important:</b> Enable the app in your Shopify Theme Editor (App Embeds) before using blocks.
                </Text>
              </Banner>
              <Text as="h3" variant="headingMd">1. Open Shopify Theme Editor</Text>
              <Text as="p">Go to <b>Online Store &gt; Themes &gt; Customize</b>.</Text>
              <Text as="h3" variant="headingMd">2. Enable App Embeds</Text>
              <Text as="p">In the theme editor, click <b>App embeds</b> (puzzle icon), find <b>Dista App</b>, and enable it.</Text>
              <Text as="h3" variant="headingMd">3. Add App Blocks</Text>
              <List type="bullet">
                <List.Item><b>Recently Viewed Products:</b> Add the <b>Recently Viewed Products</b> block to any section (homepage, product page, etc.).</List.Item>
                <List.Item><b>Recently Ordered Products:</b> Add the <b>Recently Ordered Products</b> block to customer account or thank you pages.</List.Item>
                <List.Item><b>Recently Viewed Minicart:</b> Add the <b>Recently Viewed Minicart</b> block to your minicart or cart drawer area in the theme editor. This enables recently viewed products in the minicart for both desktop and mobile users.</List.Item>
              </List>
              <Text as="h3" variant="headingMd">4. Save and Publish</Text>
              <Text as="p">Click <b>Save</b> in the theme editor to apply changes to your storefront blocks.</Text>
              <Text as="h3" variant="headingMd">5. Configure Appearance (Optional)</Text>
              <Text as="p">To fully customize the look and feel of your <b>Recently Viewed</b> and <b>Recently Ordered</b> sections, go to <b>Custom CSS</b> in the app admin. Here you can adjust layout, colors, and more for each section.</Text>
              <Text as="h3" variant="headingMd">6. Configure Checkout Validation Rules</Text>
              <Text as="p">To set up <b>Checkout Validation & Payment Rules</b>, use the <b>Checkout Validations</b> page in the app admin.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}