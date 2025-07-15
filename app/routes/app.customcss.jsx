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
  const settings = await prisma.customCSS.findUnique({ where: { shop } });
  return json({
    css: settings?.css || '',
    showAddToCart: settings?.showAddToCart ?? true,
    showBuyNow: settings?.showBuyNow ?? true,
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
  const showBuyNow = formData.get('showBuyNow') === 'true';
  const displayMode = formData.get('displayMode') || 'carousel';
  const productsPerRow = parseInt(formData.get('productsPerRow') || '3', 10);
  const initialProducts = parseInt(formData.get('initialProducts') || '6', 10);
  const cardLayout = formData.get('cardLayout') || 'vertical';

  try {
    const data = {
      shop,
      css,
      showAddToCart,
      showBuyNow,
      displayMode,
      productsPerRow,
      initialProducts,
      cardLayout
    };

    await prisma.customCSS.upsert({
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
  const { css, showAddToCart, showBuyNow, displayMode, productsPerRow, initialProducts, cardLayout } = useLoaderData();
  const actionData = useActionData();

  const [customCSS, setCustomCSS] = useState(css);
  const [showATC, setShowATC] = useState(showAddToCart);
  const [showBuyNowBtn, setshowBuyNowBtn] = useState(showBuyNow);
  const [displayModeValue, setDisplayModeValue] = useState(displayMode);
  const [productsPerRowValue, setProductsPerRowValue] = useState(productsPerRow);
  const [initialProductsValue, setInitialProductsValue] = useState(initialProducts);
  const [success, setSuccess] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [cardLayoutState, setCardLayoutState] = useState(cardLayout); // New state for layout

  useEffect(() => {
    if (actionData?.success) {
      setSuccess(true);
      const timer = setTimeout(() => {
        setSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const handleSubmit = (e) => {
    setSuccess(false);
  };

  const cssGuide = {
    productCard: [
      '.recently-viewed-card – Main container for each product card',
      '.recently-viewed-card--horizontal – Horizontal layout for product card',
      '.recently-viewed-image-wrapper – Container for product image',
      '.recently-viewed-image-link – Link wrapping the product image',
      '.recently-viewed-image – Product image element',
      '.recently-viewed-badge – Sale/offer badge',
      '.recently-viewed-details – Container for product details',
      '.recently-viewed-title – Product title',
      '.recently-viewed-title-minicart – Product title in minicart',
      '.recently-viewed-reviews-link – Link wrapping the reviews section',
      '.recently-viewed-reviews – Container for star ratings',
      '.recently-viewed-stars – Star rating display',
      '.recently-viewed-review-count – Number of reviews',
      '.recently-viewed-price-wrapper – Container for price',
      '.recently-viewed-price – Current price',
      '.recently-viewed-compare-price – Original/compare price',
      '.recently-viewed-button-container – Container for buttons',
      '.recently-viewed-atc-button – Add to Cart button',
      '.recently-viewed-atc-button-text – Text inside Add to Cart button',
      '.recently-viewed-buy-now-form – Form for Buy Now functionality',
      '.recently-viewed-buy-now-button – Buy Now button',
      '.recently-viewed-buy-now-button-text – Text inside Buy Now button',
      '.recently-viewed-buy-now-icon – Icon inside Buy Now button',
    ],
    carousel: [
      '.recently-viewed-container – Main container',
      '.recently-viewed-carousel-wrapper – Carousel container',
      '.recently-viewed-carousel – Carousel track',
      '.recently-viewed-carousel-prev – Previous button',
      '.recently-viewed-carousel-next – Next button',
      '.recently-viewed-carousel--minicart – Carousel for minicart',
      '.recently-viewed-carousel-wrapper--minicart – Carousel wrapper for minicart',
    ],
    grid: [
      '.recently-viewed-grid – Grid container',
      '.recently-viewed-show-more-container – Show more button container',
      '.recently-viewed-show-more-button – Show more button',
    ],
    minicart: [
      '.recently-viewed-carousel--minicart .recently-viewed-card – Minicart product card',
      '.recently-viewed-carousel--minicart .recently-viewed-card--horizontal – Minicart horizontal card',
      '.recently-viewed-carousel--minicart .recently-viewed-image-wrapper – Minicart image wrapper',
      '.recently-viewed-carousel--minicart .recently-viewed-details – Minicart details',
      '.recently-viewed-carousel--minicart .recently-viewed-title-minicart – Minicart product title',
      '.recently-viewed-carousel--minicart .recently-viewed-price – Minicart price',
      '.recently-viewed-carousel--minicart .recently-viewed-compare-price – Minicart compare price',
      '.recently-viewed-carousel--minicart .recently-viewed-badge – Minicart badge',
      '.recently-viewed-carousel--minicart .recently-viewed-stars – Minicart stars',
      '.recently-viewed-carousel--minicart .recently-viewed-review-count – Minicart review count',
    ],
    variables: [
      '--rv-primary – Primary color (default: #0066cc)',
      '--rv-buynow – Buy Now button color (default: #4caf50)',
      '--rv-badge – Badge color (default: #e7ac17)',
      '--rv-border – Border color (default: #e1e1e1)',
      '--rv-text – Text color (default: #333)',
      '--rv-star-filled – Filled star color (default: #ffb400)',
      '--rv-star-empty – Empty star color (default: #e1e1e1)'
    ],
    headings: [
      '.rvp-heading – Heading for Recently Viewed Products section'
    ]
  };

  return (
    <AppProvider i18n={{}}>
      <Page
        title="Recently Viewed Settings"
        primaryAction={{
          content: "Save Settings",
          onAction: () => {
            // Submit the form programmatically
            document.getElementById('custom-css-form')?.requestSubmit();
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
                  <Form id="custom-css-form" method="post" onSubmit={handleSubmit}>
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
                            onChange={(value) => {
                              setDisplayModeValue(value);
                            }}
                          />
                          <input type="hidden" name="displayMode" value={displayModeValue} />

                          {displayModeValue === 'grid' && (
                            <>
                              <RangeSlider
                                label="Products per row (In Desktop)"
                                name="productsPerRow"
                                value={productsPerRowValue}
                                onChange={(value) => {
                                  setProductsPerRowValue(value);
                                }}
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
                                onChange={(value) => {
                                  setInitialProductsValue(value);
                                }}
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

                      <Card title="Card Layout" sectioned>
                        <Select
                          label="Card Layout"
                          name="cardLayout"
                          options={[
                            { label: 'Vertical', value: 'vertical' },
                            { label: 'Horizontal', value: 'horizontal' }
                          ]}
                          value={cardLayoutState}
                          onChange={(value) => {
                            setCardLayoutState(value);
                          }}
                        />
                        <input type="hidden" name="cardLayout" value={cardLayout} />
                      </Card>

                      <Card title="Button Visibility" sectioned>
                        <FormLayout>
                          <Checkbox
                            label="Show Add to Cart button"
                            name="showAddToCart"
                            value="true"
                            checked={showATC}
                            onChange={() => {
                              setShowATC(!showATC);
                            }}
                          />
                          <Checkbox
                            label="Show Buy Now button"
                            name="showBuyNow"
                            value="true"
                            checked={showBuyNowBtn}
                            onChange={() => {
                              setshowBuyNowBtn(!showBuyNowBtn);
                            }}
                          />
                        </FormLayout>
                      </Card>

                      <Card title="Custom CSS" sectioned>
                        <TextField
                          label="Custom CSS"
                          name="css"
                          multiline={24}
                          value={customCSS}
                          onChange={(value) => {
                            setCustomCSS(value);
                          }}
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
                      Use these classes to customize the appearance of your Recently Viewed section.
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
                      <Text variant="headingSm" as="h3">Minicart Classes</Text>
                      <List type="bullet">
                        {cssGuide.minicart.map((item, index) => (
                          <List.Item key={`minicart-${index}`}>{item}</List.Item>
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
                        {`.recently-viewed-card {
  --rvp-primary: #0066cc;
  --rvp-buynow: #4caf50;
  --rvp-badge: #e7ac17;
  border: 1px solid var(--rvp-border);
}

.recently-viewed-title {
  color: var(--rvp-text);
  font-size: 16px;
}

.recently-viewed-atc-button {
  background: var(--rvp-primary);
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
