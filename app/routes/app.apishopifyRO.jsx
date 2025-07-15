// recently-ordered/app/routes/app.apishopify.jsx
import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function fetchRecentlyOrderedProducts(customerId, currency, storeUrl) {
  // Use the myshopify domain from the frontend
  const storeHostname = storeUrl;

  const session = await prisma.session.findFirst({
    where: { shop: storeHostname },
    orderBy: { expires: "desc" },
  });

  if (!session || !session.accessToken) {
    throw new Error("Admin access token not found.");
  }

  const adminAccessToken = session.accessToken;
  const shopDomain = storeHostname;

  // Use the latest API version
  const apiVersion = '2023-10';

  const query = `
      query getCustomerOrders($customerId: ID!, $currency: [CurrencyCode!]!) {
        customer(id: $customerId) {
          orders(first: 50, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                lineItems(first: 5) {
                  edges {
                    node {
                      variant {
                        id
                        title
                        presentmentPrices(first: 1, presentmentCurrencies: $currency) {
                          edges {
                            node {
                              price { amount currencyCode }
                              compareAtPrice { amount currencyCode }
                            }
                          }
                        }
                      }
                      product {
                        id
                        title
                        handle
                        featuredImage { url altText }
                        images(first: 10) {
                          edges { node { url altText } }
                        }
                        rating: metafield(namespace: "reviews", key: "rating") { value }
                        reviewCount: metafield(namespace: "reviews", key: "rating_count") { value }
                        variants(first: 10) {
                          edges {
                            node {
                              id
                              title
                              availableForSale
                              presentmentPrices(first: 1, presentmentCurrencies: $currency) {
                                edges {
                                  node {
                                    price { amount currencyCode }
                                    compareAtPrice { amount currencyCode }
                                  }
                                }
                              }
                              selectedOptions { name value }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

  const requestOptions = {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": adminAccessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { customerId, currency: [currency] } }), // Pass currency as an array
  };

  try {
    const response = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
      requestOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GraphQL API error (${response.status}):`, errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();


    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    const orders = result.data?.customer?.orders?.edges || [];


    const productMap = new Map();

    orders.forEach(order => {
      order.node.lineItems.edges.forEach(item => {
        const product = item.node.product;
        const variant = item.node.variant;

        if (product && !productMap.has(product.id)) {
          let rating = null;
          let ratingCount = null;

          try {
            const parsed = JSON.parse(product.rating?.value || "{}");
            rating = parseFloat(parsed.value || "0");
            ratingCount = parseInt(product.reviewCount?.value || "0", 10);
          } catch (error) {
            console.error("Failed to parse rating:", error);
          }

          // Map all variants of the product
          const variants = product.variants?.edges.map(variantEdge => {
            const variantNode = variantEdge.node;
            return {
              id: variantNode.id,
              title: variantNode.title,
              availableForSale: variantNode.availableForSale,
              presentmentPrice: variantNode.presentmentPrices.edges?.[0]?.node?.price?.amount || null,
              presentmentCurrency: variantNode.presentmentPrices.edges?.[0]?.node?.price?.currencyCode || null,
              presentmentCompareAtPrice: variantNode.presentmentPrices.edges?.[0]?.node?.compareAtPrice?.amount || null,
              selectedOptions: variantNode.selectedOptions || [],
            };
          }) || [];

          // Map all images of the product
          const images = product.images?.edges.map(imageEdge => {
            const imageNode = imageEdge.node;
            return {
              url: imageNode.url,
              altText: imageNode.altText || "No description available",
            };
          }) || [];

          productMap.set(product.id, {
            id: product.id,
            title: product.title,
            url: `/products/${product.handle}`,
            image: product.featuredImage?.url || "https://via.placeholder.com/100",
            images: images, // Include all product images
            variants: variants, // Use the mapped variants
            rating: rating,
            ratingCount: ratingCount,
          });
        }
      });
    });

    const products = Array.from(productMap.values());


    return products;
  } catch (error) {
    console.error("Error fetching recently ordered products:", error);
    throw error; // Re-throw to handle in the loader
  }
}

function verifyHmac(originalValue, receivedHmac) {
  const SECRET_KEY = 'Polina';
  const computedHmac = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(originalValue)
    .digest('hex');
  return computedHmac === receivedHmac;
}


export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // Handle product data request
  let customerId = url.searchParams.get("customerId") || "";
  let secret = url.searchParams.get("uid") || "";
  let currency = url.searchParams.get("currency") || "USD";
  let storeUrl = url.searchParams.get("storeUrl") || "";
  const verified = verifyHmac(customerId, secret);

  if (!verified) {
    return json({ error: "Invalid Request" }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (!customerId) {
    return json({ error: "Customer ID is required" }, {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const storeHostname = storeUrl;

    // Check if we have a valid session
    const session = await prisma.session.findFirst({
      where: { shop: storeHostname },
      orderBy: { expires: "desc" },
    });

    if (!session || !session.accessToken) {
      return json({ error: "Authentication required. Please reinstall the app." }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // Check if token is expired
    if (session.expires && new Date(session.expires) < new Date()) {
      return json({ error: "Session expired. Please reinstall the app." }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const orderedProducts = await fetchRecentlyOrderedProducts(`gid://shopify/Customer/${customerId}`, currency, storeHostname);

    // Get the latest CSS settings
    const cssSettings = await prisma.customCSS_RO.findUnique({
      where: { shop: storeHostname },
    });

    // Get widget settings
    const widgetSettings = await prisma.widgetSettings.findFirst({
      where: { shop: storeHostname },
    });

    return json({
      products: orderedProducts,
      settings: {
        showAddToCart: cssSettings?.showAddToCart ?? true,
        showReorder: cssSettings?.showReorder ?? true,
        displayMode: cssSettings?.displayMode || 'carousel',
        productsPerRow: cssSettings?.productsPerRow || 3,
        initialProducts: cssSettings?.initialProducts || 6,
        css: cssSettings?.css || '',
        cardLayout: cssSettings?.cardLayout || 'vertical'
      },
      widgetSettings: {
        starsText: widgetSettings?.starsText || '{count} review/reviews',
        saveText: widgetSettings?.saveText || 'Save {percent}%'
      }
    }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    console.error("Error in loader:", error);

    // Check for specific error types
    if (error.message.includes("Admin access token not found")) {
      return json({ error: "Authentication required. Please reinstall the app." }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    if (error.message.includes("HTTP error! Status: 401")) {
      return json({ error: "Authentication failed. Please reinstall the app." }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    return json({ error: "Failed to fetch ordered products" }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};
