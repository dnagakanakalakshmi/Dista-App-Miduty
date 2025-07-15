import { json } from "@remix-run/node";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


async function verifyHmac(originalValue, receivedHmac) {
  const secret = 'Polina';
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(originalValue);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    messageData
  );

  const expectedHmac = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return expectedHmac === receivedHmac;
}

async function getApiCredentials() {
  try {
    const apiCredentials = await prisma.apiCredentials.findFirst();
    if (!apiCredentials) {
      console.error("No API credentials found in the database.");
      return null;
    }
    return apiCredentials;
  } catch (error) {
    console.error("Error retrieving API credentials:", error);
    throw error;
  }
}


export const action = async ({ request }) => {
  try {

    // Handle product view tracking
    const body = await request.json();
    let customerId = body.customerId || "";
    let sessionId = body.sessionId || "";
    let productId = body.productId;
    let token = body.token || "";
    let storeUrl = body.storeUrl || ""; // myshopify domain from frontend
    let newToken = null;
    let secret = body.uid || ""; // Secret key for HMAC verification
    // Extract subdomain for store_id (e.g., 'rajahmart-international' from 'rajahmart-international.myshopify.com')
    const storeDomain = storeUrl.split('.')[0];
    var verified = false;
    const credentials = await getApiCredentials();
    const bearer_token = credentials?.token || null;
    const base_url = credentials?.baseUrl || null;

    verified = verifyHmac(customerId, secret);

    if (!verified) {
      console.error("HMAC verification failed.");
      return json({ error: "Unauthorized" }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    if (customerId.length > 13) customerId = "";

    // 🔐 Get new token if not provided
    if (!token) {
      try {
        const jwtResponse = await axios.post(
          `${base_url}/internal/storefront/auth`,
          customerId
            ? { store_id: storeDomain, customer_id: customerId }
            : { store_id: storeDomain, session_id: sessionId },
          {
            headers: {
              Authorization: `Bearer ${bearer_token}`,
            },
          }
        );
        newToken = jwtResponse.data.access_token;
        token = newToken;
      } catch (authError) {
        console.error("Failed to fetch JWT token:", authError);
        return json({ error: "Unauthorized" }, {
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // Store viewed product
    await axios.post(`${base_url}/internal/storefront/recently-viewed/additem`, {
      product_id: productId,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return json(
      { reply: 'Successful', token: newToken },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Error in action:", error);
    return json({ reply: "Internal Server Error" }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};


async function fetchShopifyProducts(productIds, currency, storeUrl) {
  // Use the myshopify domain from the frontend
  const storeHostname = storeUrl;

  const session = await prisma.session.findFirst({
    where: { shop: storeHostname },
    orderBy: { expires: "desc" },
  });

  if (!session || !session.accessToken) {
    throw new Error("Admin access token not found.");
  }

  // Use the latest API version
  const apiVersion = '2023-10';

  const graphql = JSON.stringify({
    query: `query getRecentlyViewedProducts($ids: [ID!]!, $currency: [CurrencyCode!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          images(first: 10) {
            edges { node { url altText } }
          }
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
          rating: metafield(namespace: "reviews", key: "rating") {
            value
          }
          reviewCount: metafield(namespace: "reviews", key: "rating_count") {
            value
          }
        }
      }
    }`,
    variables: { ids: productIds, currency: [currency] },
  });

  const requestOptions = {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": session.accessToken,
      "Content-Type": "application/json",
    },
    body: graphql,
  };

  try {
    const response = await fetch(
      `https://${storeHostname}/admin/api/${apiVersion}/graphql.json`,
      requestOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GraphQL API error (${response.status}):`, errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    let result = await response.json();
    result = (result.data.nodes || []).filter(product => product !== null);

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    return result.map(node => {
      let rating = null;
      let ratingCount = null;

      try {
        if (node.rating?.value) {
          const parsed = JSON.parse(node.rating.value);
          rating = parseFloat(parsed.value);
        }
        if (node.reviewCount?.value) {
          ratingCount = parseInt(node.reviewCount.value, 10);
        }
      } catch (error) {
        console.error("Failed to parse rating:", error);
      }
      return {
        id: node.id,
        title: node.title,
        url: `/products/${node.handle}`,
        image: node.featuredImage?.url || "https://via.placeholder.com/100",
        images: node.images?.edges?.map(edge => ({
          url: edge.node.url,
          altText: edge.node.altText
        })) || [],
        variants: node.variants?.edges?.map(edge => ({
          id: edge.node.id,
          title: edge.node.title || '',
          availableForSale: edge.node.availableForSale,
          presentmentPrice: edge.node.presentmentPrices?.edges?.[0]?.node?.price?.amount || null,
          presentmentCurrency: edge.node.presentmentPrices?.edges?.[0]?.node?.price?.currencyCode || null,
          presentmentCompareAtPrice: edge.node.presentmentPrices?.edges?.[0]?.node?.compareAtPrice?.amount || null,
          selectedOptions: edge.node.selectedOptions || [],
        })) || [],
        rating,
        ratingCount
      };
    });
  } catch (error) {
    console.error("Error fetching Shopify products:", error);
    throw error;
  }
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  // Handle product data request

  let customerId = url.searchParams.get("customerId") || "";
  let sessionId = url.searchParams.get("sessionId") || "";
  let storeUrl = url.searchParams.get("storeUrl") || "";
  let token = url.searchParams.get("token") || "";
  let newToken = null;
  let currency = url.searchParams.get("currency") || "USD"; // Default to USD if not provided
  let secret = url.searchParams.get("uid") || ""; // Secret key for HMAC verification
  // Extract subdomain for store_id (e.g., 'rajahmart-international' from 'rajahmart-international.myshopify.com')
  const storeDomain = storeUrl.split('.')[0];
  const credentials = await getApiCredentials();
  const bearer_token = credentials?.token || null;
  const base_url = credentials?.baseUrl || null;

  var verified = false;
  verified = verifyHmac(customerId, secret);

  if (!verified) {
    console.error("HMAC verification failed.");
    return json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  if (customerId.length > 13) customerId = "";


  try {
    // Check if we have a valid session
    const storeHostname = storeUrl;
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

    if (!token) {

      const jwtResponse = await axios.post(
        `${base_url}/internal/storefront/auth`,
        customerId
          ? { store_id: storeDomain, customer_id: customerId }
          : { store_id: storeDomain, session_id: sessionId },
        {
          headers: {
            Authorization: `Bearer ${bearer_token}`,
          },
        }
      );
      newToken = jwtResponse.data.access_token;
      token = newToken;
    }

    if (customerId && sessionId) {
      await axios.post(`${base_url}/internal/storefront/recently-viewed/merge`, {
        session_id: sessionId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const response = await axios.get(`${base_url}/internal/storefront/recently-viewed`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const recentlyViewed = response.data.recently_viewed_items;

    let productData = [];
    if (recentlyViewed && recentlyViewed.length > 0) {
      const productIds = recentlyViewed.map(item => `gid://shopify/Product/${item.product_id}`);
      productData = await fetchShopifyProducts(productIds, currency, storeUrl);
    } else {
      console.log("No recently viewed products found.");
    }

    // Get the latest CSS settings
    const cssSettings = await prisma.customCSS.findUnique({
      where: { shop: storeHostname },
    });

    // Get widget settings
    const widgetSettings = await prisma.widgetSettings.findFirst({
      where: { shop: storeHostname },
    });

    return json({
      products: productData,
      token: newToken,
      settings: {
        showAddToCart: cssSettings?.showAddToCart ?? true,
        showBuyNow: cssSettings?.showBuyNow ?? true,
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

    return json({ error: "Failed to fetch recently viewed products" }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};