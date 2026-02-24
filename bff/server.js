import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fetch from 'node-fetch';
import { DefaultAzureCredential } from '@azure/identity';

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.BFF_PORT || 3001;
const APIM_MANAGEMENT_URL = process.env.APIM_MANAGEMENT_URL || 'https://demo-apim-feb.management.azure-api.net';
const APIM_API_VERSION = process.env.APIM_API_VERSION || '2021-08-01';
const NODE_ENV = process.env.NODE_ENV || 'development';

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
    credential = new DefaultAzureCredential();
    console.log('✅ Azure Managed Identity credential initialized');
  }
  return credential;
}

/**
 * Get access token using Managed Identity
 * Caches token until expiry
 */
async function getAccessToken() {
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
    throw new Error('Failed to authenticate with Managed Identity');
  }
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
 * Proxy all requests to APIM Management API with Managed Identity auth
 */
app.use('*', async (req, res) => {
  try {
    // Get access token using Managed Identity
    const token = await getAccessToken();

    // Build target URL
    const path = req.originalUrl.startsWith('/') ? req.originalUrl.slice(1) : req.originalUrl;
    
    // Add api-version if not present
    const url = new URL(path, APIM_MANAGEMENT_URL);
    if (!url.searchParams.has('api-version')) {
      url.searchParams.set('api-version', APIM_API_VERSION);
    }

    console.log(`🔄 Proxying to: ${url.toString()}`);

    // Forward request to APIM
    const apimResponse = await fetch(url.toString(), {
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
  console.log(`🔗 APIM URL:      ${APIM_MANAGEMENT_URL}`);
  console.log(`🔐 Auth:          Azure Managed Identity`);
  console.log(`🌍 Environment:   ${NODE_ENV}`);
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
