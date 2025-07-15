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
  Checkbox,
  Select,
  RangeSlider,
  Tabs,
  Banner,
  List
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import shopify from "../shopify.server";

const prisma = new PrismaClient();

function addImportantToCSS(css) {
  return css.replace(/([^;{}\n]+)(;)/g, (match, declaration, end) => {
    if (declaration.includes('!important')) return match;
    return declaration.trim() + ' !important' + end;
  });
}

export const loader = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const { shop } = session;
  const settings = await prisma.customCSS_RO.findUnique({ where: { shop } });
  return json({
    css: settings?.css || '',
    showAddToCart: settings?.showAddToCart ?? true,
    showReorder: settings?.showReorder ?? true,
    displayMode: settings?.displayMode || 'carousel',
    productsPerRow: settings?.productsPerRow || 3,
    initialProducts: settings?.initialProducts || 6,
    cardLayout: settings?.cardLayout || 'vertical'
  });
};

export const action = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();
  let css = formData.get('css') || '';
  css = addImportantToCSS(css);
  const showAddToCart = formData.get('showAddToCart') === 'true';
  const showReorder = formData.get('showReorder') === 'true';
  const displayMode = formData.get('displayMode') || 'carousel';
  const productsPerRow = parseInt(formData.get('productsPerRow') || '3', 10);
  const initialProducts = parseInt(formData.get('initialProducts') || '6', 10);
  const cardLayout = formData.get('cardLayout') || 'vertical';

  try {
    const data = {
      shop,
      css,
      showAddToCart,
      showReorder,
      displayMode,
      productsPerRow,
      initialProducts,
      cardLayout
    };

    await prisma.customCSS_RO.upsert({
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

export default function CustomCSSAdmin() {
  const { css, showAddToCart, showReorder, displayMode, productsPerRow, initialProducts, cardLayout } = useLoaderData();
  const actionData = useActionData();
  const [customCSS, setCustomCSS] = useState(css);
  const [showATC, setShowATC] = useState(showAddToCart);
  const [showReorderBtn, setShowReorderBtn] = useState(showReorder);
  const [displayModeValue, setDisplayModeValue] = useState(displayMode);
  const [productsPerRowValue, setProductsPerRowValue] = useState(productsPerRow);
  const [initialProductsValue, setInitialProductsValue] = useState(initialProducts);
  const [cardLayoutValue, setCardLayoutValue] = useState(cardLayout);
  const [success, setSuccess] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    if (actionData?.success) {
      setSuccess(true);
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const handleSubmit = (e) => {
    setSuccess(false);
  };

  const cssGuide = {
    productCard: [
      '.recently-ordered-card – Main container for each product card',
      '.recently-ordered-card--horizontal – Horizontal layout for product card',
      '.recently-ordered-image-wrapper – Container for product image',
      '.recently-ordered-image-link – Link wrapping the product image',
      '.recently-ordered-image – Product image element',
      '.recently-ordered-badge – Sale/offer badge',
      '.recently-ordered-sale-tag – Sale percentage tag',
      '.recently-ordered-details – Container for product details',
      '.recently-ordered-title – Product title',
      '.recently-ordered-reviews-link – Link wrapping the reviews section',
      '.recently-ordered-reviews – Container for star ratings',
      '.recently-ordered-stars – Star rating display',
      '.recently-ordered-review-count – Number of reviews',
      '.recently-ordered-price-wrapper – Container for price',
      '.recently-ordered-price – Current price',
      '.recently-ordered-compare-price – Original/compare price',
      '.recently-ordered-button-container – Container for buttons',
      '.recently-ordered-atc-button – Add to Cart button',
      '.recently-ordered-atc-button-text – Text inside Add to Cart button',
      '.recently-ordered-reorder-button – Reorder button',
      '.recently-ordered-reorder-button-text – Text inside Reorder button',
    ],
    carousel: [
      '.recently-ordered-container – Main container',
      '.recently-ordered-carousel-wrapper – Carousel container',
      '.recently-ordered-carousel – Carousel track',
      '.recently-ordered-carousel-prev – Previous button',
      '.recently-ordered-carousel-next – Next button',
    ],
    grid: [
      '.recently-ordered-grid – Grid container',
      '.recently-ordered-show-more-container – Show more button container',
      '.recently-ordered-show-more-button – Show more button',
    ],
    variables: [
      '--ro-primary – Primary color (default: #0066cc)',
      '--ro-reorder – Reorder button color (default: #4caf50)',
      '--ro-badge – Badge color (default: #e7ac17)',
      '--ro-border – Border color (default: #e1e1e1)',
      '--ro-text – Text color (default: #333)',
      '--ro-star-filled – Filled star color (default: #ffb400)',
      '--ro-star-empty – Empty star color (default: #e1e1e1)'
    ],
    headings: [
      '.ro-heading – Heading for Recently Ordered Products section'
    ]
  };

  return (
    <AppProvider i18n={{}}>
      <Page
        title="Recently Ordrered Settings"
        primaryAction={{
          content: "Save Settings",
          onAction: () => {
            // Submit the form programmatically
            document.getElementById('custom-css-form-ro')?.requestSubmit();
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
                { id: 'settings', content: 'Settings' },
                { id: 'css-guide', content: 'CSS Guide' }
              ]} selected={selectedTab} onSelect={setSelectedTab}>
                {selectedTab === 0 ? (
                  <Form id="custom-css-form-ro" method="post" onSubmit={handleSubmit}>
                    <FormLayout>
                      <Card title="Display Settings" sectioned>
                        <FormLayout>
                          <Select
                            label="Display Mode"
                            name="displayMode"
                            options={[
                              { label: 'Carousel', value: 'carousel' },
                              { label: 'Grid', value: 'grid' }
                            ]}
                            value={displayModeValue}
                            onChange={setDisplayModeValue}
                          />
                          <input type="hidden" name="displayMode" value={displayModeValue} />

                          <Select
                            label="Card Layout"
                            name="cardLayout"
                            options={[
                              { label: 'Vertical', value: 'vertical' },
                              { label: 'Horizontal', value: 'horizontal' }
                            ]}
                            value={cardLayoutValue}
                            onChange={setCardLayoutValue}
                          />
                          <input type="hidden" name="cardLayout" value={cardLayoutValue} />

                          {displayModeValue === 'grid' && (
                            <>
                              <RangeSlider
                                label="Products per row (In Desktop)"
                                name="productsPerRow"
                                value={productsPerRowValue}
                                onChange={setProductsPerRowValue}
                                min={1}
                                max={6}
                                step={1}
                                output
                              />
                              <input type="hidden" name="productsPerRow" value={productsPerRowValue} />

                              <RangeSlider
                                label="Initial products to show"
                                name="initialProducts"
                                value={initialProductsValue}
                                onChange={setInitialProductsValue}
                                min={2}
                                max={12}
                                step={1}
                                output
                              />
                              <input type="hidden" name="initialProducts" value={initialProductsValue} />
                            </>
                          )}
                        </FormLayout>
                      </Card>

                      <Card title="Button Visibility" sectioned>
                        <FormLayout>
                          <Checkbox
                            label="Show Add to Cart button"
                            name="showAddToCart"
                            value="true"
                            checked={showATC}
                            onChange={() => setShowATC(!showATC)}
                          />
                          <Checkbox
                            label="Show Reorder button"
                            name="showReorder"
                            value="true"
                            checked={showReorderBtn}
                            onChange={() => setShowReorderBtn(!showReorderBtn)}
                          />
                        </FormLayout>
                      </Card>

                      <Card title="Custom CSS" sectioned>
                        <TextField
                          label="Custom CSS"
                          name="css"
                          multiline={24}
                          value={customCSS}
                          onChange={setCustomCSS}
                          autoComplete="off"
                          helpText="Add custom CSS styles for the product cards"
                        />
                      </Card>

                      <Button submit primary>
                        Save Settings
                      </Button>
                    </FormLayout>
                  </Form>
                ) : (
                  <Card sectioned>
                    <Text variant="headingMd" as="h2">CSS Classes Guide</Text>
                    <Text as="p" color="subdued">
                      Use these classes to customize the appearance of your Recently Ordered section.
                    </Text>

                    <div style={{ marginTop: '20px' }}>
                      <Text variant="headingSm" as="h3">Product Card Classes</Text>
                      <List type="bullet">
                        {cssGuide.productCard.map((item, index) => (
                          <List.Item key={`card-${index}`}>{item}</List.Item>
                        ))}
                      </List>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <Text variant="headingSm" as="h3">Carousel Classes</Text>
                      <List type="bullet">
                        {cssGuide.carousel.map((item, index) => (
                          <List.Item key={`carousel-${index}`}>{item}</List.Item>
                        ))}
                      </List>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <Text variant="headingSm" as="h3">Grid Classes</Text>
                      <List type="bullet">
                        {cssGuide.grid.map((item, index) => (
                          <List.Item key={`grid-${index}`}>{item}</List.Item>
                        ))}
                      </List>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <Text variant="headingSm" as="h3">CSS Variables</Text>
                      <List type="bullet">
                        {cssGuide.variables.map((item, index) => (
                          <List.Item key={`var-${index}`}>{item}</List.Item>
                        ))}
                      </List>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <Text variant="headingSm" as="h3">Example Usage</Text>
                      <pre style={{
                        backgroundColor: '#f6f6f7',
                        padding: '16px',
                        borderRadius: '4px',
                        overflow: 'auto'
                      }}>
                        {`.recently-ordered-card {
  --ro-primary: #0066cc;
  --ro-reorder: #4caf50;
  border: 1px solid var(--ro-border);
}

.recently-ordered-title {
  color: var(--ro-text);
  font-size: 16px;
}

.recently-ordered-atc-button {
  background: var(--ro-primary);
  color: white;
}`}
                      </pre>
                    </div>
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