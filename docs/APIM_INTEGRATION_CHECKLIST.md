# Komatsu APIM Integration - Quick Checklist

> **Status:** 🚧 Not Started  
> **Target Completion:** TBD  
> **Dependencies:** Komatsu APIM Customization Framework setup

---

## 📋 Pre-Integration Requirements

### Documentation from Komatsu Team
- [ ] **APIM Framework API Documentation**
  - REST API endpoints specification
  - Request/response schemas (OpenAPI/Swagger)
  - Authentication mechanism details
  - Rate limiting and throttling policies
  
- [ ] **Integration Architecture Diagram**
  - Component interaction flow
  - Network topology and security zones
  - Data flow diagrams
  
- [ ] **Authentication & Authorization**
  - Entra ID integration guide
  - User-to-APIM user mapping
  - Role/group mapping for RBAC
  - Token validation requirements
  
- [ ] **Subscription Management**
  - Subscription creation workflow
  - Approval process (manual vs automatic)
  - Key generation and rotation policies
  - Subscription lifecycle management
  
- [ ] **Environment Details**
  - Dev environment URLs
  - Staging environment URLs
  - Production environment URLs
  - VNet/firewall requirements

### Azure Resources Setup
- [ ] **Azure APIM Instance**
  - [ ] Created and configured
  - [ ] Custom domain configured
  - [ ] SSL certificates installed
  - [ ] CORS policies configured
  
- [ ] **Azure Key Vault**
  - [ ] Created for secrets storage
  - [ ] Access policies configured
  - [ ] APIM subscription keys stored
  
- [ ] **Managed Identity**
  - [ ] System-assigned identity for backend API
  - [ ] Key Vault access granted
  - [ ] APIM access permissions configured
  
- [ ] **Networking**
  - [ ] VNet integration (if required)
  - [ ] Private endpoints (if required)
  - [ ] NSG rules configured
  - [ ] Firewall rules configured

---

## 🔧 Code Implementation

### Backend Service (Required)
- [ ] **Project Setup**
  - [ ] Create `server/` directory
  - [ ] Initialize Node.js/Express project
  - [ ] Configure TypeScript
  - [ ] Set up environment variables
  - [ ] Configure logging (Application Insights)
  
- [ ] **Core Services**
  - [ ] APIM client service
  - [ ] Authentication middleware
  - [ ] Error handling middleware
  - [ ] Request/response logging
  - [ ] Caching layer (Redis)
  
- [ ] **API Endpoints**
  - [ ] `GET /api/apis` - List APIs
  - [ ] `GET /api/apis/:id` - Get API details
  - [ ] `GET /api/apis/:id/operations` - Get operations
  - [ ] `GET /api/apis/:id/swagger` - Get OpenAPI spec
  - [ ] `GET /api/subscriptions` - List user subscriptions
  - [ ] `POST /api/subscriptions` - Create subscription
  - [ ] `POST /api/subscriptions/:id/regenerate` - Regenerate keys
  - [ ] `DELETE /api/subscriptions/:id` - Cancel subscription
  - [ ] `GET /api/products` - List products
  - [ ] `POST /api/try-it` - Proxy for Try-It console
  
- [ ] **Health & Monitoring**
  - [ ] `/health` endpoint
  - [ ] Application Insights integration
  - [ ] Custom metrics and events
  - [ ] Error tracking

### Frontend Updates
- [ ] **API Client Enhancement**
  - [ ] Update `src/api/client.ts` with PUT/DELETE methods
  - [ ] Add APIM header support (`Ocp-Apim-Subscription-Key`)
  - [ ] Implement retry logic for transient failures
  - [ ] Add request/response interceptors
  
- [ ] **New Type Definitions**
  - [ ] Create `src/api/apimTypes.ts`
  - [ ] Define APIM-specific interfaces
  - [ ] Update existing types to match APIM models
  
- [ ] **New Pages/Components**
  - [ ] `src/pages/MySubscriptions.tsx` - Subscription management
  - [ ] Update `src/pages/ApiDetails.tsx` - Add subscription UI
  - [ ] Update `src/pages/ApiTryIt.tsx` - Integrate with APIM proxy
  - [ ] `src/components/SubscriptionKeyManager.tsx` - Key display/copy/regenerate
  
- [ ] **Routing Updates**
  - [ ] Add `/my/subscriptions` route
  - [ ] Update navigation menu
  
- [ ] **Mock-to-Real Migration**
  - [ ] Replace mock data in `src/api/mockData.ts`
  - [ ] Add feature flag for mock/real toggle
  - [ ] Update tests with real API schemas

### Infrastructure as Code
- [ ] **Bicep Templates**
  - [ ] Update `azure/container-app.bicep` with APIM parameters
  - [ ] Add Key Vault resource
  - [ ] Add managed identity configuration
  - [ ] Add APIM-related environment variables
  
- [ ] **Parameter Files**
  - [ ] Update `azure/parameters.dev.json`
  - [ ] Update `azure/parameters.staging.json`
  - [ ] Update `azure/parameters.prod.json`
  
- [ ] **Deployment Scripts**
  - [ ] Update `azure/deploy.ps1`
  - [ ] Update `azure/deploy.sh`
  - [ ] Add secret injection from Key Vault

---

## 🧪 Testing

### Unit Tests
- [ ] Backend service unit tests (70% coverage minimum)
- [ ] Frontend component tests for new features
- [ ] Update existing tests with APIM types

### Integration Tests
- [ ] API catalog retrieval
- [ ] Subscription creation workflow
- [ ] Key regeneration
- [ ] Subscription cancellation
- [ ] Try-It console proxy
- [ ] Error handling scenarios

### End-to-End Tests
- [ ] Complete user registration to API call flow
- [ ] Subscription approval workflow
- [ ] Multi-API subscription management
- [ ] Analytics data retrieval

### Performance Tests
- [ ] Load testing (expected concurrent users)
- [ ] API response time benchmarks
- [ ] Caching effectiveness
- [ ] Database query optimization

### Security Tests
- [ ] Authentication bypass attempts
- [ ] Authorization boundary testing
- [ ] API key exposure prevention
- [ ] SQL injection / XSS testing
- [ ] CORS policy validation
- [ ] Secret scanning in code

---

## 🚀 Deployment

### Development Environment
- [ ] Deploy backend API to Azure
- [ ] Configure environment variables
- [ ] Test APIM connectivity
- [ ] Deploy updated frontend
- [ ] Smoke testing
- [ ] Integration testing

### Staging Environment
- [ ] Deploy backend API
- [ ] Configure production-like settings
- [ ] Deploy frontend
- [ ] UAT testing with stakeholders
- [ ] Performance testing
- [ ] Security scanning

### Production Environment
- [ ] Final code review
- [ ] Security audit completion
- [ ] Backup plan documented
- [ ] Rollback procedure tested
- [ ] Deploy backend API
- [ ] Deploy frontend
- [ ] Post-deployment verification
- [ ] Monitor for 24 hours
- [ ] Hypercare support

---

## 📚 Documentation

### Technical Documentation
- [ ] Architecture diagrams
- [ ] API integration guide
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] Security documentation
- [ ] Disaster recovery plan

### User Documentation
- [ ] Developer quickstart guide
- [ ] API subscription tutorial
- [ ] Try-It console usage
- [ ] FAQ document
- [ ] Video tutorials (optional)

### Operational Documentation
- [ ] Monitoring and alerting guide
- [ ] Incident response procedures
- [ ] Escalation matrix
- [ ] SLA documentation
- [ ] Maintenance windows

---

## 🔍 Validation

### Before Go-Live Checklist
- [ ] All P0/P1 bugs resolved
- [ ] 70%+ test coverage achieved
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] UAT sign-off obtained
- [ ] EARB approval received
- [ ] Runbook reviewed by operations
- [ ] Support team trained
- [ ] Monitoring dashboards configured
- [ ] Alerts configured and tested

### Success Criteria
- [ ] API catalog displays from APIM
- [ ] Users can create subscriptions
- [ ] Subscription keys visible and functional
- [ ] Try-It console works with live APIs
- [ ] Analytics data displays correctly
- [ ] No critical errors in Application Insights
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms (p95)

---

## 📞 Contacts

### Komatsu Team
- **APIM Framework Lead:** [Name] - [Email]
- **Integration Support:** [Name] - [Email]
- **DevOps Contact:** [Name] - [Email]

### Komatsu IT Team
- **Project Manager:** [Name] - [Email]
- **Tech Lead:** [Name] - [Email]
- **DevOps Lead:** [Name] - [Email]

### Escalation
- **Level 1:** Komatsu Support Team
- **Level 2:** Komatsu APIM Architect
- **Level 3:** Microsoft Azure Support

---

## 🎯 Timeline (Estimated)

| Phase | Duration | Status |
|-------|----------|--------|
| Requirements Gathering | 1 week | ⏳ Pending |
| Backend Development | 2 weeks | ⏳ Pending |
| Frontend Updates | 1 week | ⏳ Pending |
| Integration Testing | 1 week | ⏳ Pending |
| UAT & Security Testing | 1 week | ⏳ Pending |
| Production Deployment | 1 week | ⏳ Pending |
| **Total** | **7 weeks** | |

---

**Last Updated:** 2026-02-17  
**Document Owner:** Komatsu IT Team
