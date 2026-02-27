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

// APIM Data API configuration (same data source as the portal's DataApiClient)
// If not set, auto-discovered from ARM service description on first use.
const APIM_DATA_API_URL = process.env.APIM_DATA_API_URL || null;
const APIM_DATA_API_VERSION = process.env.APIM_DATA_API_VERSION || '2022-04-01-preview';

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
// Data API Discovery & SAS Token Management
// ============================================================================

let dataApiBaseUrl = APIM_DATA_API_URL;
let sasToken = null;
let sasTokenExpiry = null;

/**
 * Auto-discover the Data API URL from the ARM service description.
 * Mirrors api-management-developer-portal's ArmService.loadSettings():
 *   const dataApiUrl = serviceDescription.properties.dataApiUrl;
 *   backendUrl = serviceDescription.properties.developerPortalUrl;
 *   return directDataApi ? dataApiUrl : `${backendUrl}/developer`;
 */
async function ensureDataApiUrl() {
  if (dataApiBaseUrl) return dataApiBaseUrl;

  console.log('\u{1F50D} Discovering Data API URL from ARM service description...');
  const token = await getAccessToken();
  const url = `${APIM_ARM_BASE_URL}?api-version=${APIM_API_VERSION}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to discover APIM service: ${response.status} - ${body}`);
  }

  const service = await response.json();
  const portalUrl = (service.properties.developerPortalUrl || '').replace(/\/$/, '');

  // DataApiClient uses: backendUrl + '/developer' (when directDataApi is falsy)
  // or dataApiUrl directly (when directDataApi is truthy).
  // We prefer the explicit dataApiUrl if available, otherwise portal + /developer.
  dataApiBaseUrl = service.properties.dataApiUrl || `${portalUrl}/developer`;

  console.log(`\u2705 Data API URL: ${dataApiBaseUrl}`);
  return dataApiBaseUrl;
}

/**
 * Generate a SAS token for Data API access via ARM.
 * Mirrors api-management-developer-portal's ArmService.getUserAccessToken().
 * POST /users/1/token → SharedAccessSignature uid=1&ex=...&sn=...
 */
async function getDataApiSasToken() {
  if (USE_MOCK_MODE) return 'mock-sas-token';

  const now = Date.now();
  // Return cached token if still valid (with 5 min buffer)
  if (sasToken && sasTokenExpiry && now < sasTokenExpiry - 300000) {
    return sasToken;
  }

  const armToken = await getAccessToken();
  const exp = new Date(now + 60 * 60 * 1000).toISOString();
  const tokenUrl = `${APIM_ARM_BASE_URL}/users/1/token?api-version=${APIM_API_VERSION}`;

  console.log(`\u{1F511} Generating Data API SAS token (expires ${exp})...`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${armToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyType: 'primary', expiry: exp }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to generate SAS token: ${response.status} - ${body}`);
  }

  const data = await response.json();
  sasToken = data.value;
  sasTokenExpiry = now + 55 * 60 * 1000; // refresh 5 min before actual expiry

  console.log('\u{1F511} Data API SAS token acquired');
  return sasToken;
}

/**
 * Fetch data from the APIM Data API.
 * Mirrors the DataApiClient request flow: base URL + path + api-version + SAS auth.
 */
async function fetchFromDataApi(path, method = 'GET', body = null) {
  const baseUrl = await ensureDataApiUrl();
  const token = await getDataApiSasToken();

  // Build the full URL: base + path + api-version
  const hasSlash = path.startsWith('/');
  const fullPath = `${baseUrl}${hasSlash ? '' : '/'}${path}`;
  const targetUrl = new URL(fullPath);

  if (!targetUrl.searchParams.has('api-version')) {
    targetUrl.searchParams.set('api-version', APIM_DATA_API_VERSION);
  }

  console.log(`\u{1F504} Data API: ${method} ${targetUrl.toString()}`);

  const options = {
    method,
    headers: {
      'Authorization': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(targetUrl.toString(), options);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`\u274C Data API error: ${response.status} - ${errorBody}`);
    const error = new Error(`Data API returned ${response.status}`);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
}

// ============================================================================
// Data API Response Transformers
// ============================================================================

/**
 * Transform a Data API item to the flat ApiSummary format expected by the frontend.
 * Data API returns flat contracts (no ARM .properties wrapper):
 *   { id: "echo-api", name: "Echo API", description: "...", path: "echo", ... }
 * This mirrors the mapApimApiToSummary() mapper in the frontend types.ts.
 */
function transformDataApiToSummary(item) {
  const shortId = item.id || item.name || 'unknown';

  // Derive status from name/path hints (APIM has no native status field)
  const lowerName = (item.name || shortId || '').toLowerCase();
  const lowerPath = (item.path || '').toLowerCase();
  let status = 'Production';
  if (lowerName.includes('sandbox') || lowerPath.includes('sandbox') || lowerName.includes('test')) {
    status = 'Sandbox';
  }

  const tags = Array.isArray(item.tags) ? item.tags : [];
  const plan = item.subscriptionRequired ? 'Paid' : 'Free';

  return {
    id: shortId,
    name: item.name || shortId,
    description: item.description || '',
    status,
    owner: item.contact?.name || 'Komatsu',
    tags,
    category: tags.length > 0 ? tags[0] : 'General',
    plan,
    path: item.path,
    protocols: item.protocols,
    apiVersion: item.apiVersion,
    type: item.type || 'http',
    subscriptionRequired: item.subscriptionRequired,
  };
}

/**
 * Transform a Data API item to the full ApiDetails format expected by the frontend.
 * Data API operations and products are also flat contracts.
 */
function transformDataApiToDetails(item, operations = [], products = []) {
  const summary = transformDataApiToSummary(item);

  // Build plans from products, or provide a default
  const plans = products.length > 0
    ? products.map(p => ({
        name: p.displayName || p.name || 'Default',
        quota: p.subscriptionRequired ? 'Subscription required' : 'Open',
        notes: p.description || '',
      }))
    : [{ name: summary.plan, quota: summary.subscriptionRequired ? 'Subscription required' : 'Open access', notes: '' }];

  // Transform operations — Data API returns flat operation contracts
  const ops = operations.map(op => ({
    id: op.id || op.name || 'unknown',
    name: op.name || '',
    method: op.method || 'GET',
    urlTemplate: op.urlTemplate || '',
    displayName: op.displayName || op.name || '',
    description: op.description || '',
  }));

  return {
    ...summary,
    overview: item.description || summary.description || `API documentation for ${summary.name}`,
    documentationUrl: `https://${APIM_SERVICE_NAME}.developer.azure-api.net/api-details#api=${summary.id}`,
    openApiUrl: `/apis/${summary.id}/openapi`,
    plans,
    operations: ops,
    contact: item.contact,
    license: item.license,
    termsOfServiceUrl: item.termsOfServiceUrl,
  };
}

/**
 * Helper: Fetch data from ARM API with authentication.
 * Kept for auto-discovery of the Data API URL and SAS token generation.
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

  console.log(`\u{1F504} ARM request: GET ${targetUrl.toString()}`);

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
    console.error(`\u274C ARM API error: ${response.status} - ${errorBody}`);
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
        content: 'Welcome to the Komatsu APIM Developer Portal. Start exploring our API catalog to integrate with Komatsu services.',
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
  // Real-mode Route Handlers (Data API — same source as DataApiClient)
  // ============================================================================

  /**
   * GET /stats — Platform statistics from real APIM Data API.
   * Aggregates counts of APIs, products, subscriptions, and users.
   */
  app.get('/stats', async (req, res) => {
    try {
      const [apisData, productsData, subscriptionsData, usersData] = await Promise.allSettled([
        fetchFromDataApi('/apis?$top=1'),
        fetchFromDataApi('/products?$top=1'),
        fetchFromDataApi('/subscriptions?$top=1'),
        fetchFromDataApi('/users?$top=1'),
      ]);

      const apiCount = apisData.status === 'fulfilled' ? (apisData.value.count ?? (apisData.value.value || []).length) : 0;
      const productCount = productsData.status === 'fulfilled' ? (productsData.value.count ?? (productsData.value.value || []).length) : 0;
      const subscriptionCount = subscriptionsData.status === 'fulfilled' ? (subscriptionsData.value.count ?? (subscriptionsData.value.value || []).length) : 0;
      const userCount = usersData.status === 'fulfilled' ? (usersData.value.count ?? (usersData.value.value || []).length) : 0;

      console.log(`\u2705 Stats: ${apiCount} APIs, ${productCount} products, ${subscriptionCount} subscriptions, ${userCount} users`);
      res.json({
        availableApis: apiCount,
        products: productCount,
        subscriptions: subscriptionCount,
        users: userCount,
        uptime: '99.9%',
      });
    } catch (error) {
      console.error('\u274C Error fetching stats:', error.message);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /apis — List all APIs from the APIM Data API, transformed to flat ApiSummary[] array.
   * Data API returns flat contracts (no ARM .properties wrapper).
   */
  app.get('/apis', async (req, res) => {
    try {
      // Forward OData query params from the frontend (e.g. $top, $skip, $filter)
      const qs = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
      const path = qs ? `/apis?${qs}` : '/apis';

      const data = await fetchFromDataApi(path);
      const apis = (data.value || []).map(transformDataApiToSummary);
      console.log(`\u2705 Transformed ${apis.length} APIs from Data API`);
      res.json(apis);
    } catch (error) {
      console.error('\u274C Error fetching APIs:', error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch APIs',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/highlights — Returns top APIs as highlights.
   */
  app.get('/apis/highlights', async (req, res) => {
    try {
      const data = await fetchFromDataApi('/apis?$top=3');
      const apis = (data.value || []).map(transformDataApiToSummary);
      res.json(apis);
    } catch (error) {
      console.error('\u274C Error fetching API highlights:', error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch API highlights',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/:apiId — Fetch single API details, operations, and products from Data API.
   * Returns a flat ApiDetails object with operations inlined.
   */
  app.get('/apis/:apiId', async (req, res) => {
    try {
      const { apiId } = req.params;

      // Fetch API, operations, and products in parallel from Data API
      const [apiData, opsData, prodsData] = await Promise.all([
        fetchFromDataApi(`/apis/${apiId}`),
        fetchFromDataApi(`/apis/${apiId}/operations?$top=100`).catch(() => ({ value: [] })),
        fetchFromDataApi(`/apis/${apiId}/products?$top=50`).catch(() => ({ value: [] })),
      ]);

      const details = transformDataApiToDetails(
        apiData,
        opsData.value || [],
        prodsData.value || [],
      );

      console.log(`\u2705 Transformed API details for: ${apiId}`);
      res.json(details);
    } catch (error) {
      console.error(`\u274C Error fetching API ${req.params.apiId}:`, error.message);
      res.status(error.status || 500).json({
        error: 'Failed to fetch API details',
        message: error.message,
      });
    }
  });

  /**
   * GET /apis/:apiId/subscription — Subscription status for a specific API.
   */
  app.get('/apis/:apiId/subscription', async (req, res) => {
    try {
      // Data API supports listing subscriptions scoped to an API
      const data = await fetchFromDataApi(`/subscriptions?$filter=endswith(scope,'/apis/${req.params.apiId}')&$top=1`);
      const sub = (data.value || [])[0];
      res.json({ status: sub ? (sub.state || 'Active') : 'Not subscribed' });
    } catch {
      res.json({ status: 'Not subscribed' });
    }
  });

  /**
   * GET /apis/:apiId/openapi — Export the OpenAPI specification via ARM.
   * Note: Schema export still uses ARM as the Data API doesn't expose this directly.
   */
  app.get('/apis/:apiId/openapi', async (req, res) => {
    try {
      const { apiId } = req.params;
      const format = req.query.format || 'swagger-link';
      const token = await getAccessToken();

      const exportUrl = `${APIM_ARM_BASE_URL}/apis/${apiId}?format=${format}&export=true&api-version=${APIM_API_VERSION}`;
      console.log(`\u{1F504} Exporting OpenAPI spec: GET ${exportUrl}`);

      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`\u274C OpenAPI export error: ${response.status} - ${body}`);
        return res.status(response.status).json({ error: 'Failed to export OpenAPI spec' });
      }

      const data = await response.json();

      // ARM export returns { properties: { value: { link: "<url>" } } } for link formats
      const link = data?.properties?.value?.link || data?.properties?.link;
      if (link && typeof link === 'string' && link.startsWith('http')) {
        return res.redirect(link);
      }

      const specLink = data?.properties?.value;
      if (specLink && typeof specLink === 'string' && specLink.startsWith('http')) {
        return res.redirect(specLink);
      }

      res.json(data);
    } catch (error) {
      console.error(`\u274C Error exporting OpenAPI spec for ${req.params.apiId}:`, error.message);
      res.status(500).json({ error: 'Failed to export OpenAPI spec' });
    }
  });

  /**
   * GET /products — List all published products from the Data API.
   */
  app.get('/products', async (req, res) => {
    try {
      const qs = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
      const path = qs ? `/products?${qs}` : "/products?$filter=state eq 'published'";
      const data = await fetchFromDataApi(path);
      const products = (data.value || []).map(p => ({
        id: p.id || p.name,
        name: p.displayName || p.name,
        description: p.description || '',
        plan: p.subscriptionRequired ? 'Paid' : 'Free',
        subscriptionRequired: p.subscriptionRequired,
      }));
      res.json(products);
    } catch (error) {
      console.error('\u274C Error fetching products:', error.message);
      res.status(error.status || 500).json({ error: 'Failed to fetch products' });
    }
  });

  /**
   * GET /subscriptions — List current subscriptions from the Data API.
   */
  app.get('/subscriptions', async (req, res) => {
    try {
      const data = await fetchFromDataApi('/subscriptions?$top=100');
      const subs = (data.value || []).map(s => ({
        id: s.id || s.name,
        name: s.displayName || s.name,
        scope: s.scope,
        state: s.state || 'active',
        primaryKey: s.primaryKey,
        secondaryKey: s.secondaryKey,
      }));
      res.json(subs);
    } catch (error) {
      console.error('\u274C Error fetching subscriptions:', error.message);
      res.status(error.status || 500).json({ error: 'Failed to fetch subscriptions' });
    }
  });
}

/**
 * Catch-all: Proxy unmatched requests to the APIM Data API.
 * This replaces the ARM proxy — Data API returns flat contracts directly.
 */
app.use('*', async (req, res) => {
  try {
    // In mock mode, return generic mock data if no specific endpoint matched
    if (USE_MOCK_MODE) {
      const mockData = {
        value: [
          {
            id: 'mock-item-1',
            name: 'Mock Data for Local Development',
            description: 'This is generic mock data - consider adding a specific endpoint in server.js',
          },
        ],
        message: 'Generic mock data (USE_MOCK_MODE=true) - no specific endpoint defined',
        path: req.originalUrl,
      };
      console.log(`\u{1F9EA} Returning generic mock data for: ${req.originalUrl}`);
      return res.json(mockData);
    }

    // Forward to Data API (flat contracts, no ARM wrapper)
    const path = req.originalUrl.startsWith('/') ? req.originalUrl : `/${req.originalUrl}`;
    const body = req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null;

    console.log(`\u{1F504} Proxying to Data API: ${req.method} ${path}`);

    const data = await fetchFromDataApi(path, req.method, body);
    res.json(data);

    console.log(`\u2705 Data API response forwarded for: ${path}`);

  } catch (error) {
    console.error('\u274C Data API proxy error:', error);
    res.status(error.status || 500).json({
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
  console.log(`\u{1F4E1} Port:          ${PORT}`);
  console.log(`\u{1F517} APIM:          ${APIM_SERVICE_NAME} (${AZURE_RESOURCE_GROUP})`);
  console.log(`\u{1F517} Data API:      ${APIM_DATA_API_URL || '(auto-discover from ARM)'}`);
  console.log(`\u{1F517} Data API ver:  ${APIM_DATA_API_VERSION}`);
  console.log(`\u{1F517} ARM Base:      ${APIM_ARM_BASE_URL}`);
  console.log(`\u{1F512} Auth:          ${USE_MOCK_MODE ? 'Mock Mode (Development)' : 'Azure MI → SAS Token'}`);
  console.log(`\u{1F30D} Environment:   ${NODE_ENV}`);
  if (USE_MOCK_MODE) {
    console.log('');
    console.log('\u26A0\uFE0F  WARNING: Running in MOCK MODE');
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
