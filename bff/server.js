import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fetch from 'node-fetch';
import { DefaultAzureCredential } from '@azure/identity';

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.BFF_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Azure ARM API configuration (used to call APIM Management via ARM)
const AZURE_SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || '121789fa-2321-4e44-8aee-c6f1cd5d7045';
const AZURE_RESOURCE_GROUP = process.env.AZURE_RESOURCE_GROUP || 'kac_apimarketplace_eus_dev_rg';
const APIM_SERVICE_NAME = process.env.APIM_SERVICE_NAME || 'demo-apim-feb';
const APIM_API_VERSION = process.env.APIM_API_VERSION || '2022-08-01';

// Construct the ARM base URL for APIM
const APIM_ARM_BASE_URL = `https://management.azure.com/subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/${AZURE_RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_SERVICE_NAME}`;

// Mock mode for local development (set to 'true' to use mock data)
const USE_MOCK_MODE = process.env.USE_MOCK_MODE === 'true' || false;

// User-Assigned Managed Identity Client ID (optional, for Azure deployments)
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MANAGED_IDENTITY_CLIENT_ID;

// Azure Management API scope for authentication
const AZURE_MANAGEMENT_SCOPE = 'https://management.azure.com/.default';

// ============================================================================
// Azure Managed Identity Authentication
// ============================================================================

let credential;
let cachedToken = null;
let tokenExpiry = null;

/**
 * Initialize Azure Managed Identity credential
 */
function initializeCredential() {
  if (!credential) {
    // Configure DefaultAzureCredential with optional client ID for user-assigned identity
    const options = AZURE_CLIENT_ID ? { managedIdentityClientId: AZURE_CLIENT_ID } : {};
    credential = new DefaultAzureCredential(options);
    
    if (AZURE_CLIENT_ID) {
      console.log(`✅ Azure Managed Identity credential initialized (User-Assigned: ${AZURE_CLIENT_ID})`);
    } else {
      console.log('✅ Azure Managed Identity credential initialized (System-Assigned or Azure CLI)');
    }
  }
  return credential;
}

/**
 * Get access token using Managed Identity
 * Caches token until expiry
 */
async function getAccessToken() {
  // In mock mode, return a fake token for local development
  if (USE_MOCK_MODE) {
    console.log('🧪 Using mock authentication (development mode)');
    return 'mock-token-for-local-development';
  }

  const now = Date.now();
  
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && tokenExpiry && now < tokenExpiry - 300000) {
    return cachedToken;
  }

  try {
    const cred = initializeCredential();
    const tokenResponse = await cred.getToken(AZURE_MANAGEMENT_SCOPE);
    
    cachedToken = tokenResponse.token;
    tokenExpiry = tokenResponse.expiresOnTimestamp;
    
    console.log(`🔑 Access token acquired, expires at ${new Date(tokenExpiry).toISOString()}`);
    return cachedToken;
  } catch (error) {
    console.error('❌ Failed to acquire access token:', error.message);
    console.error('💡 TIP: For local development, set USE_MOCK_MODE=true in your .env file');
    console.error('💡 Or run: az login');
    throw new Error('Failed to authenticate with Managed Identity');
  }
}

// ============================================================================
// ARM Response Transformers
// ============================================================================

/**
 * Transform an ARM API item to the flat ApiSummary format expected by the frontend.
 * ARM format: { id: "/subscriptions/.../apis/echo-api", name: "echo-api", properties: { displayName, ... } }
 * Frontend format: { id: "echo-api", name: "Echo API", description: "...", status: "Production", ... }
 */
function transformArmApiToSummary(armItem) {
  const props = armItem.properties || {};
  const shortId = armItem.name || armItem.id?.split('/').pop() || 'unknown';

  // Derive status from name/path hints (APIM has no native status field)
  const lowerName = (shortId).toLowerCase();
  const lowerPath = (props.path || '').toLowerCase();
  let status = 'Production';
  if (lowerName.includes('sandbox') || lowerPath.includes('sandbox') || lowerName.includes('test')) {
    status = 'Sandbox';
  }

  // Derive plan from subscriptionRequired flag
  const plan = props.subscriptionRequired ? 'Paid' : 'Free';

  return {
    id: shortId,
    name: props.displayName || shortId,
    description: props.description || '',
    status,
    owner: props.contact?.name || 'Komatsu',
    tags: [],
    category: 'General',
    plan,
    path: props.path,
    protocols: props.protocols,
    apiVersion: props.apiVersion,
    type: props.type || 'http',
    subscriptionRequired: props.subscriptionRequired,
  };
}

/**
 * Transform an ARM API item to the full ApiDetails format expected by the frontend.
 * Includes overview, documentation URL, and plans (derived from products if available).
 */
function transformArmApiToDetails(armItem, operations = [], products = []) {
  const summary = transformArmApiToSummary(armItem);
  const props = armItem.properties || {};

  // Build plans from products, or provide a default
  const plans = products.length > 0
    ? products.map(p => ({
        name: p.properties?.displayName || p.name || 'Default',
        quota: p.properties?.subscriptionRequired ? 'Subscription required' : 'Open',
        notes: p.properties?.description || '',
      }))
    : [{ name: summary.plan, quota: summary.subscriptionRequired ? 'Subscription required' : 'Open access', notes: '' }];

  // Transform operations
  const ops = operations.map(op => ({
    id: op.name || op.id?.split('/').pop() || 'unknown',
    name: op.name || op.properties?.name || '',
    method: op.properties?.method || 'GET',
    urlTemplate: op.properties?.urlTemplate || '',
    displayName: op.properties?.displayName || op.name || '',
    description: op.properties?.description || '',
  }));

  return {
    ...summary,
    overview: props.description || summary.description || `API documentation for ${summary.name}`,
    documentationUrl: `https://${APIM_SERVICE_NAME}.developer.azure-api.net/api-details#api=${summary.id}`,
    openApiUrl: `/apis/${summary.id}/openapi`,
    plans,
    operations: ops,
    contact: props.contact,
    license: props.license,
    termsOfServiceUrl: props.termsOfServiceUrl,
  };
}

/**
 * Helper: Fetch data from ARM API with authentication
 */
async function fetchFromArm(path, queryParams = {}) {
  const token = await getAccessToken();
  const targetUrl = new URL(`${APIM_ARM_BASE_URL}/${path}`);
  if (!targetUrl.searchParams.has('api-version')) {
    targetUrl.searchParams.set('api-version', APIM_API_VERSION);
  }
  for (const [key, value] of Object.entries(queryParams)) {
    targetUrl.searchParams.set(key, value);
  }

  console.log(`🔄 ARM request: GET ${targetUrl.toString()}`);

  const response = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ ARM API error: ${response.status} - ${errorBody}`);
    const error = new Error(`ARM API returned ${response.status}`);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
}

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Handled by nginx
}));

// CORS - allow requests from same origin (nginx proxy)
app.use(cors({
  origin: true,
  credentials: true,
}));

// JSON body parser
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'apim-portal-bff',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// APIM Proxy Routes
// ============================================================================

/**
 * Mock data endpoints for local development
 */
if (USE_MOCK_MODE) {
  // Mock news/announcements endpoint
  app.get('/news', (req, res) => {
    console.log('🧪 Returning mock news data');
    res.json([
      {
        id: '1',
        title: 'Welcome to APIM Developer Portal',
        excerpt: 'Get started with our API catalog and developer resources.',
        date: new Date().toISOString(),
        content: 'Welcome to the Infosys APIM Developer Portal. Start exploring our API catalog to integrate with Komatsu services.',
        author: 'APIM Team',
        category: 'Announcement',
      },
      {
        id: '2',
        title: 'New APIs Available',
        excerpt: 'Check out the latest additions to our API catalog.',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        content: 'We have added new APIs to help you build better integrations.',
        author: 'Product Team',
        category: 'Product Update',
      },
      {
        id: '3',
        title: 'Maintenance Schedule',
        excerpt: 'Planned maintenance window this weekend.',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        content: 'Scheduled maintenance will occur this weekend. All services will be back online by Monday.',
        author: 'Operations',
        category: 'System',
      },
    ]);
  });

  // Mock stats endpoint
  app.get('/stats', (req, res) => {
    console.log('🧪 Returning mock stats data');
    res.json({
      availableApis: 3,
      products: 2,
      subscriptions: 5,
      uptime: '99.9%',
    });
  });

  // Mock APIs list endpoint
  app.get('/apis', (req, res) => {
    console.log('🧪 Returning mock APIs data');
    res.json([
      {
        id: 'warranty-api',
        name: 'Warranty API',
        description: 'Warranty claims and coverage validation.',
        status: 'Production',
        owner: 'Komatsu Warranty',
        tags: ['claims', 'coverage', 'warranty'],
        category: 'Warranty',
        plan: 'Paid',
        path: '/warranty',
        protocols: ['https'],
        subscriptionRequired: true,
      },
      {
        id: 'punchout-api',
        name: 'Punchout API',
        description: 'Dealer commerce and parts ordering.',
        status: 'Sandbox',
        owner: 'Commerce Platform',
        tags: ['commerce', 'orders', 'punchout'],
        category: 'Commerce',
        plan: 'Free',
        path: '/punchout',
        protocols: ['https'],
        subscriptionRequired: false,
      },
      {
        id: 'equipment-api',
        name: 'Equipment API',
        description: 'Fleet data, telemetry, and lifecycle info.',
        status: 'Production',
        owner: 'Equipment Insights',
        tags: ['fleet', 'telemetry', 'equipment'],
        category: 'Equipment',
        plan: 'Internal',
        path: '/equipment',
        protocols: ['https'],
        subscriptionRequired: true,
      },
    ]);
  });

  // Mock API highlights endpoint
  app.get('/apis/highlights', (req, res) => {
    console.log('🧪 Returning mock API highlights data');
    res.json([
      {
        id: 'warranty-api',
        name: 'Warranty API',
        description: 'Warranty claims and coverage validation.',
        status: 'Production',
        owner: 'Komatsu Warranty',
        tags: ['claims', 'coverage', 'warranty'],
        category: 'Warranty',
        plan: 'Paid',
        path: '/warranty',
        protocols: ['https'],
        subscriptionRequired: true,
      },
      {
        id: 'punchout-api',
        name: 'Punchout API',
        description: 'Dealer commerce and parts ordering.',
        status: 'Sandbox',
        owner: 'Commerce Platform',
        tags: ['commerce', 'orders', 'punchout'],
        category: 'Commerce',
        plan: 'Free',
        path: '/punchout',
        protocols: ['https'],
        subscriptionRequired: false,
      },
      {
        id: 'equipment-api',
        name: 'Equipment API',
        description: 'Fleet data, telemetry, and lifecycle info.',
        status: 'Production',
        owner: 'Equipment Insights',
        tags: ['fleet', 'telemetry', 'equipment'],
        category: 'Equipment',
        plan: 'Internal',
        path: '/equipment',
        protocols: ['https'],
        subscriptionRequired: true,
      },
    ]);
  });

  // Mock API details endpoint (specific API by ID)
  app.get('/apis/:apiId', (req, res) => {
    const { apiId } = req.params;
    console.log(`🧪 Returning mock API details for: ${apiId}`);
    
    const apiDetailsMap = {
      'warranty-api': {
        id: 'warranty-api',
        name: 'Warranty API',
        description: 'Warranty claims and coverage validation.',
        status: 'Production',
        owner: 'Komatsu Warranty',
        tags: ['claims', 'coverage', 'warranty'],
        category: 'Warranty',
        plan: 'Paid',
        path: '/warranty',
        protocols: ['https'],
        subscriptionRequired: true,
        overview: 'Accelerate warranty processing with trusted warranty coverage data, claim lifecycle events, and entitlement validation.',
        documentationUrl: '/docs/warranty',
        plans: [
          { name: 'Sandbox', quota: '1k calls/day', notes: 'Testing only' },
          { name: 'Production', quota: '50k calls/day', notes: 'SLA backed' },
        ],
        operations: [
          {
            id: 'get-warranty',
            name: 'getWarranty',
            method: 'GET',
            urlTemplate: '/warranty/{serialNumber}',
            displayName: 'Get Warranty',
            description: 'Returns warranty coverage for a given serial number.',
          },
          {
            id: 'submit-claim',
            name: 'submitClaim',
            method: 'POST',
            urlTemplate: '/warranty/claims',
            displayName: 'Submit Claim',
            description: 'Creates a new warranty claim.',
          },
        ],
      },
      'punchout-api': {
        id: 'punchout-api',
        name: 'Punchout API',
        description: 'Dealer commerce and parts ordering.',
        status: 'Sandbox',
        owner: 'Commerce Platform',
        tags: ['commerce', 'orders', 'punchout'],
        category: 'Commerce',
        plan: 'Free',
        path: '/punchout',
        protocols: ['https'],
        subscriptionRequired: false,
        overview: 'Enable seamless dealer commerce integration with parts ordering, catalog browsing, and cart management capabilities.',
        documentationUrl: '/docs/punchout',
        plans: [
          { name: 'Sandbox', quota: '500 calls/day', notes: 'Testing environment' },
          { name: 'Production', quota: '10k calls/day', notes: 'Production use' },
        ],
        operations: [
          {
            id: 'create-session',
            name: 'createSession',
            method: 'POST',
            urlTemplate: '/punchout/session',
            displayName: 'Create Session',
            description: 'Initiates a new punchout session.',
          },
          {
            id: 'get-catalog',
            name: 'getCatalog',
            method: 'GET',
            urlTemplate: '/punchout/catalog',
            displayName: 'Get Catalog',
            description: 'Retrieves the parts catalog.',
          },
        ],
      },
      'equipment-api': {
        id: 'equipment-api',
        name: 'Equipment API',
        description: 'Fleet data, telemetry, and lifecycle info.',
        status: 'Production',
        owner: 'Equipment Insights',
        tags: ['fleet', 'telemetry', 'equipment'],
        category: 'Equipment',
        plan: 'Internal',
        path: '/equipment',
        protocols: ['https'],
        subscriptionRequired: true,
        overview: 'Access comprehensive fleet data including real-time telemetry, maintenance history, and equipment lifecycle information.',
        documentationUrl: '/docs/equipment',
        plans: [
          { name: 'Internal Only', quota: 'Unlimited', notes: 'For internal Komatsu systems' },
        ],
        operations: [
          {
            id: 'get-fleet',
            name: 'getFleet',
            method: 'GET',
            urlTemplate: '/equipment/fleet',
            displayName: 'Get Fleet',
            description: 'Returns fleet information for authorized accounts.',
          },
          {
            id: 'get-telemetry',
            name: 'getTelemetry',
            method: 'GET',
            urlTemplate: '/equipment/{serialNumber}/telemetry',
            displayName: 'Get Telemetry',
            description: 'Retrieves real-time telemetry data.',
          },
        ],
      },
    };

    const apiDetails = apiDetailsMap[apiId];
    if (apiDetails) {
      res.json(apiDetails);
    } else {
      res.status(404).json({ error: 'API not found' });
    }
  });

  // Mock API subscription status endpoint
  app.get('/apis/:apiId/subscription', (req, res) => {
    const { apiId } = req.params;
    console.log(`🧪 Returning mock subscription status for: ${apiId}`);
    
    const subscriptionStatus = {
      'warranty-api': { status: 'Active' },
      'punchout-api': { status: 'Not subscribed' },
      'equipment-api': { status: 'Pending approval' },
    };

    res.json(subscriptionStatus[apiId] || { status: 'Not subscribed' });
  });

  // Mock support FAQs endpoint
  app.get('/support/faqs', (req, res) => {
    console.log('🧪 Returning mock FAQs data');
    res.json([
      'How do I get started with the APIM Developer Portal?',
      'What authentication methods are supported?',
      'How do I subscribe to an API?',
      'What are the rate limits for sandbox vs production?',
      'Where can I find API documentation?',
      'How do I report an issue with an API?',
      'What is the SLA for production APIs?',
      'Can I test APIs in the sandbox environment?',
    ]);
  });

  // Mock support tickets endpoint
  app.get('/support/my-tickets', (req, res) => {
    console.log('🧪 Returning mock support tickets data');
    res.json([
      {
        id: 'TICKET-001',
        subject: 'API authentication issue',
        status: 'Open',
      },
      {
        id: 'TICKET-002',
        subject: 'Rate limit increase request',
        status: 'In Progress',
      },
      {
        id: 'TICKET-003',
        subject: 'Documentation clarification',
        status: 'Resolved',
      },
    ]);
  });

  // Mock user subscriptions endpoint
  app.get('/users/me/subscriptions', (req, res) => {
    console.log('🧪 Returning mock user subscriptions data');
    res.json([
      {
        apiName: 'Warranty API',
        environment: 'Production',
        status: 'Active',
        quota: '50k calls/day',
      },
      {
        apiName: 'Equipment API',
        environment: 'Production',
        status: 'Active',
        quota: '25k calls/day',
      },
      {
        apiName: 'Punchout API',
        environment: 'Sandbox',
        status: 'Active',
        quota: '1k calls/day',
      },
    ]);
  });
} else {
  // ============================================================================
  // Real-mode Route Handlers (ARM response transformation)
  // ============================================================================

  /**
   * GET /stats — Platform statistics from real APIM data.
   * Returns counts of APIs, products, subscriptions, and users.
   */
  app.get('/stats', async (req, res) => {
    try {
      const [apisData, productsData, subscriptionsData, usersData] = await Promise.allSettled([
        fetchFromArm('apis'),
        fetchFromArm('products'),
        fetchFromArm('subscriptions'),
        fetchFromArm('users'),
      ]);

      const apiCount = apisData.status === 'fulfilled' ? (apisData.value.value || []).length : 0;
      const productCount = productsData.status === 'fulfilled' ? (productsData.value.value || []).length : 0;
      const subscriptionCount = subscriptionsData.status === 'fulfilled' ? (subscriptionsData.value.value || []).length : 0;
      const userCount = usersData.status === 'fulfilled' ? (usersData.value.value || []).length : 0;

      console.log(`✅ Stats: ${apiCount} APIs, ${productCount} products, ${subscriptionCount} subscriptions, ${userCount} users`);
      res.json({
        availableApis: apiCount,
        products: productCount,
        subscriptions: subscriptionCount,
        users: userCount,
        uptime: '99.9%',
      });
    } catch (error) {
      console.error('❌ Error fetching stats:', error.message);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /apis — List all APIs from APIM via ARM, transformed to flat ApiSummary[] array.
   */
  app.get('/apis', async (req, res) => {
    try {
      const data = await fetchFromArm('apis');
      const apis = (data.value || []).map(transformArmApiToSummary);
      console.log(`✅ Transformed ${apis.length} APIs from ARM response`);
      res.json(apis);
    } catch (error) {
      console.error('❌ Error fetching APIs:', error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch APIs',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/highlights — Returns the same list as /apis (can be filtered later).
   */
  app.get('/apis/highlights', async (req, res) => {
    try {
      const data = await fetchFromArm('apis');
      const apis = (data.value || []).map(transformArmApiToSummary);
      // Return top 3 as highlights
      res.json(apis.slice(0, 3));
    } catch (error) {
      console.error('❌ Error fetching API highlights:', error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch API highlights',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/:apiId — Fetch single API details, operations, and products from ARM.
   * Returns a flat ApiDetails object with operations inlined.
   */
  app.get('/apis/:apiId', async (req, res) => {
    try {
      const { apiId } = req.params;

      // Fetch API, operations, and products in parallel
      const [apiData, opsData, prodsData] = await Promise.all([
        fetchFromArm(`apis/${apiId}`),
        fetchFromArm(`apis/${apiId}/operations`).catch(() => ({ value: [] })),
        fetchFromArm(`apis/${apiId}/products`).catch(() => ({ value: [] })),
      ]);

      const details = transformArmApiToDetails(
        apiData,
        opsData.value || [],
        prodsData.value || [],
      );

      console.log(`✅ Transformed API details for: ${apiId}`);
      res.json(details);
    } catch (error) {
      console.error(`❌ Error fetching API ${req.params.apiId}:`, error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch API details',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/:apiId/subscription — Subscription status (placeholder for real implementation).
   */
  app.get('/apis/:apiId/subscription', async (req, res) => {
    // ARM doesn't have a direct "subscription status per API" endpoint.
    // This would require querying subscriptions and filtering by scope.
    // For now, return a default status.
    res.json({ status: 'Not subscribed' });
  });

  /**
   * GET /apis/:apiId/openapi — Export the OpenAPI/Swagger specification for an API.
   * Supports ?format=openapi+json (default), openapi+json-link, swagger-json, swagger-link, wadl-link-json
   */
  app.get('/apis/:apiId/openapi', async (req, res) => {
    try {
      const { apiId } = req.params;
      const format = req.query.format || 'swagger-link';
      const token = await getAccessToken();

      // ARM export endpoint for API schema
      const exportUrl = `${APIM_ARM_BASE_URL}/apis/${apiId}?format=${format}&export=true&api-version=${APIM_API_VERSION}`;
      console.log(`🔄 Exporting OpenAPI spec: GET ${exportUrl}`);

      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`❌ OpenAPI export error: ${response.status} - ${body}`);
        return res.status(response.status).json({ error: 'Failed to export OpenAPI spec' });
      }

      const data = await response.json();

      // ARM export returns { properties: { value: { link: "<url>" } } } for link formats
      // or inline spec for non-link formats
      const link = data?.properties?.value?.link || data?.properties?.link;
      if (link && typeof link === 'string' && link.startsWith('http')) {
        return res.redirect(link);
      }

      // For string value that is a URL
      const specLink = data?.properties?.value;
      if (specLink && typeof specLink === 'string' && specLink.startsWith('http')) {
        return res.redirect(specLink);
      }

      // Return the spec inline
      res.json(data);
    } catch (error) {
      console.error(`❌ Error exporting OpenAPI spec for ${req.params.apiId}:`, error.message);
      res.status(500).json({ error: 'Failed to export OpenAPI spec' });
    }
  });
}

/**
 * Proxy all requests to APIM Management API with Managed Identity auth
 */
app.use('*', async (req, res) => {
  try {
    // In mock mode, return generic mock data if no specific endpoint matched
    if (USE_MOCK_MODE) {
      const mockData = {
        value: [
          {
            id: 'mock-item-1',
            name: 'Mock Item',
            properties: {
              displayName: 'Mock Data for Local Development',
              description: 'This is generic mock data - consider adding a specific endpoint in server.js',
            },
          },
        ],
        message: '🧪 Generic mock data (USE_MOCK_MODE=true) - no specific endpoint defined',
        path: req.originalUrl,
      };
      console.log(`🧪 Returning generic mock data for: ${req.originalUrl}`);
      return res.json(mockData);
    }

    // Get access token using Managed Identity
    const token = await getAccessToken();

    // Build ARM target URL
    const path = req.originalUrl.startsWith('/') ? req.originalUrl.slice(1) : req.originalUrl;
    
    // Construct the full ARM URL: base + path + api-version
    const targetUrl = new URL(`${APIM_ARM_BASE_URL}/${path}`);
    if (!targetUrl.searchParams.has('api-version')) {
      targetUrl.searchParams.set('api-version', APIM_API_VERSION);
    }

    console.log(`🔄 Proxying to ARM: ${targetUrl.toString()}`);

    // Forward request to APIM via ARM
    const apimResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Get response body
    const contentType = apimResponse.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await apimResponse.json();
    } else {
      data = await apimResponse.text();
    }

    // Forward response
    res.status(apimResponse.status).json(data);

    console.log(`✅ Response: ${apimResponse.status} ${apimResponse.statusText}`);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      error: 'BFF proxy error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 APIM Portal BFF Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port:          ${PORT}`);
  console.log(`🔗 APIM:          ${APIM_SERVICE_NAME} (${AZURE_RESOURCE_GROUP})`);
  console.log(`🔗 ARM Base:      ${APIM_ARM_BASE_URL}`);
  console.log(`🔐 Auth:          ${USE_MOCK_MODE ? '🧪 Mock Mode (Development)' : 'Azure Managed Identity'}`);
  console.log(`🌍 Environment:   ${NODE_ENV}`);
  if (USE_MOCK_MODE) {
    console.log('');
    console.log('⚠️  WARNING: Running in MOCK MODE');
    console.log('    All API calls will return mock data');
    console.log('    Set USE_MOCK_MODE=false to use real Azure authentication');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
