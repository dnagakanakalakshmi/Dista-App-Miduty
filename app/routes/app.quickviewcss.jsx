import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import {
  AppProvider,
  Page,
  Layout,
  Text,
  TextField,
  FormLayout,
  Button,
  Card,
  Tabs,
  Banner,
  List
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import shopify from "../shopify.server";

const prisma = new PrismaClient();

// Add !important to every property:value
function addImportantToCSS(css) {
  return css.replace(/([^;{}\n]+)(;)/g, (match, declaration, end) => {
    if (declaration.includes('!important')) return match;
    return declaration.trim() + ' !important' + end;
  });
}

export const loader = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const { shop } = session;
  const settings = await prisma.quickViewCss.findUnique({ where: { shop } });
  return json({
    css: settings?.css || ''
  });
};

export const action = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();
  let css = formData.get('css') || '';
  css = addImportantToCSS(css);

  try {
    const data = {
      shop,
      css,
    };

    await prisma.quickViewCss.upsert({
      where: { shop },
      update: { ...data, updatedAt: new Date() },
      create: data
    });

    return json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function QuickViewCSSAdmin() {
  const { css } = useLoaderData();
  const actionData = useActionData();

  const [customCSS, setCustomCSS] = useState(css);
  const [success, setSuccess] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    if (actionData?.success) {
      setSuccess(true);
      const timer = setTimeout(() => {
        setSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const cssGuide = {
    modal: [
      '.rvp-quick-view-modal-wrapper – The semi-transparent background overlay',
      '.rvp-quick-view-modal-box – The main modal container',
      '.rvp-quick-view-modal – The modal content wrapper',
      '.rvp-modal-content – The main flex container for modal content',
      '.rvp-close – The close (×) button',
      '.rvp-back-to-shop – The back to shop link in the modal',
    ],
    layout: [
      '.rvp-quick-view-left-content – The left column (images, carousel)',
      '.rvp-quick-view-right-content – The right column (product details, price, form)',
      '.rvp-thumbnail-carousel-wrapper – The vertical thumbnail carousel container',
      '.rvp-quick-view-thumbnails – The container for thumbnail images',
      '.rvp-thumbnail-image – An individual thumbnail image',
      '.rvp-main-image-carousel-wrapper – The main image carousel container',
      '.rvp-quick-view-main-image-list – The list of main images',
      '.rvp-main-image-item – An individual main product image',
      '.rvp-thumb-arrow, .rvp-main-arrow – Carousel navigation arrows',
      '.rvp-thumb-arrow-up, .rvp-thumb-arrow-down – Vertical thumbnail carousel arrows',
      '.rvp-main-arrow-left, .rvp-main-arrow-right – Main image carousel arrows',
    ],
    product: [
      '.rvp-quick-view-product-title – The product title link',
      '.rvp-quick-view-reviews – The container for star ratings and review count',
      '.rvp-qv-reviews-badge__stars – The star rating element',
      '.rvp-qv-star, .rvp-qv-star--on, .rvp-qv-star--off, .rvp-qv-star--half – Star styles',
      '.rvp-qv-reviews-badge__text – The review count text',
      '.rvp-view-details – The "View full details" link',
      '.rvp-price-wrapper – The price container',
      '.rvp-compare-at-row – The row for compare-at price',
      '.rvp-price-row – The row for price and discount',
      '#rvp-quick-view-price – The current price element',
      '.rvp-compare-at-price – The original (strikethrough) price',
      '.rvp-discount-inline – The inline discount badge',
      '.rvp-discount-badge – The main discount badge',
      '.rvp-vertical-separator – The vertical separator between price and discount',
    ],
    forms: [
      '#rvp-quick-view-form – The form for variants and add-to-cart',
      '.rvp-variants-dropdown-wrapper – The container for variant options',
      '.rvp-variant-group – A group of variant buttons',
      '.rvp-variant-label – The label for a variant option',
      '.rvp-variant-buttons – The container for variant buttons',
      '.rvp-variant-btn – A variant option button',
      '.rvp-variant-btn.selected – Selected variant button',
      '.rvp-variant-btn.rvp-variant-btn-soldout – Sold out variant button',
      '#rvp-quick-view-soldout-message – Sold out message',
      '.rvp-add-to-cart-container – The container for quantity and add-to-cart',
      '.rvp-quantity-selector – The quantity selector',
      '#rvp-decrement-qty, #rvp-increment-qty – Quantity decrement/increment buttons',
      '#rvp-quick-view-quantity – The quantity input field',
      '.rvp-add-to-cart-button – The add to cart button',
      '.rvp-add-to-cart-text – The text inside the add to cart button',
    ],
    utilities: [
      '.rvp-custom-select-arrow – Custom select dropdown arrow',
      '.rvp-quick-view-right-content, .rvp-quick-view-thumbnails – Scrollbar styling',
    ],
    responsive: [
      '@media (max-width: 768px) – Tablet/mobile styles',
      '@media (max-width: 760px) – Stacked modal layout',
    ],
  };

  return (
    <AppProvider i18n={{}}>
      <Page
        title="Quick View Modal Settings"
        primaryAction={{
          content: "Save Settings",
          onAction: () => {
            document.getElementById('quick-view-css-form')?.requestSubmit();
          },
          primary: true
        }}
      >
        <Layout>
          <Layout.Section>
            <Card sectioned>
              {success && (
                <Banner status="success">
                  <p>Settings saved successfully!</p>
                </Banner>
              )}
              {actionData?.error && (
                <Banner status="critical">
                  <p>Error: {actionData.error}</p>
                </Banner>
              )}

              <Tabs tabs={[
                { id: 'settings', content: 'Custom CSS' },
                { id: 'css-guide', content: 'CSS Guide' }
              ]} selected={selectedTab} onSelect={setSelectedTab}>
                {selectedTab === 0 ? (
                  <Form id="quick-view-css-form" method="post">
                    <FormLayout>
                      <Card title="Custom CSS for Quick View" sectioned>
                        <TextField
                          label="Custom CSS"
                          name="css"
                          multiline={24}
                          value={customCSS}
                          onChange={setCustomCSS}
                          autoComplete="off"
                          helpText="Add custom CSS styles for the quick view modal."
                        />
                      </Card>

                      <Button submit primary>
                        Save Settings
                      </Button>
                    </FormLayout>
                  </Form>
                ) : (
                  <Card sectioned>
                    <Text variant="headingMd" as="h2">Quick View CSS Classes Guide</Text>
                    <Text as="p" color="subdued">
                      Use these classes to customize the appearance of your Quick View modal.
                    </Text>

                    {Object.entries(cssGuide).map(([key, items]) => (
                      <div style={{ marginTop: '20px' }} key={key}>
                        <Text variant="headingSm" as="h3">{key.charAt(0).toUpperCase() + key.slice(1)} Classes</Text>
                        <List type="bullet">
                          {items.map((item, index) => (
                            <List.Item key={`${key}-${index}`}>{item}</List.Item>
                          ))}
                        </List>
                      </div>
                    ))}
                  </Card>
                )}
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
} 