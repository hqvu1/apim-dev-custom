/**
 * Example: Using @komatsu-nagm/component-library components
 * 
 * This file demonstrates how to integrate components from the 
 * Komatsu Component Library into your application.
 */

import React from 'react';
import { Box, Container, Typography } from '@mui/material';
// Import components from the library
import { 
  Button, 
  ApplicationCard,
  ApplicationList,
  type ApplicationCardProps 
} from '@komatsu-nagm/component-library';

/**
 * Example 1: Using Button Component
 */
export function ButtonExample() {
  const handleClick = () => {
    console.log('Button clicked!');
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <Button 
        variant="contained" 
        color="primary"
        onClick={handleClick}
      >
        Primary Action
      </Button>
      
      <Button 
        variant="outlined" 
        color="primary"
        onClick={handleClick}
      >
        Secondary Action
      </Button>
      
      <Button 
        variant="contained" 
        color="error"
        disabled
      >
        Disabled Button
      </Button>
    </Box>
  );
}

/**
 * Example 2: Using ApplicationCard
 */
export function ApplicationCardExample() {
  return (
    <ApplicationCard
      name="Warranty Management API"
      description="Access real-time warranty information and coverage details for all Komatsu equipment"
      contextType="Core System"
      icon={undefined}
      onClick={() => console.log('Card clicked!')}
      statusIndicators={[
        {
          icon: '✓',
          tooltip: 'Active'
        }
      ]}
    />
  );
}

/**
 * Example 3: Using ApplicationList with Multiple Cards
 * 
 * This is a practical example showing how to display a list of APIs
 * in your API catalog using the component library.
 */
export function ApiCatalogExample() {
  // Sample data structure - replace with your actual API data
  const apiData: ApplicationCardProps[] = [
    {
      name: 'Warranty API',
      description: 'Access warranty database and coverage information',
      contextType: 'Core System',
      onClick: () => navigate('/apis/warranty'),
    },
    {
      name: 'Punchout API',
      description: 'B2B e-commerce integration and order management',
      contextType: 'Core Technology',
      onClick: () => navigate('/apis/punchout'),
    },
    {
      name: 'Equipment Catalog API',
      description: 'Complete equipment specifications and availability',
      contextType: 'Domain Solution',
      onClick: () => navigate('/apis/equipment'),
    },
    {
      name: 'Parts Lookup API',
      description: 'Quick access to parts information and inventory',
      contextType: 'Domain Solution',
      onClick: () => navigate('/apis/parts'),
    },
  ];

  // Note: ApplicationList expects an 'applications' prop with your data
  // The component handles rendering of ApplicationCard for each item
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Available APIs
      </Typography>
      <ApplicationList applications={apiData} />
    </Container>
  );
}

/**
 * Example 4: Styling Library Components with MUI sx prop
 */
export function StyledComponentExample() {
  return (
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: 2,
      p: 2 
    }}>
      <ApplicationCard
        name="Styled Card"
        description="This card uses MUI sx styling"
        contextType="Core System"
        onClick={() => {}}
      />
      
      <Box sx={{ 
        p: 2, 
        border: '1px solid #e0e0e0',
        borderRadius: '8px'
      }}>
        <Button 
          variant="contained" 
          fullWidth
          sx={{ mb: 1 }}
        >
          Full Width Button
        </Button>
        <Typography variant="caption" color="textSecondary">
          Button inside styled container
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Example 5: Integration with React Router
 */
export function RouterIntegrationExample() {
  const navigate = useNavigate();

  const handleApiClick = (apiId: string) => {
    navigate(`/apis/${apiId}`);
  };

  return (
    <ApplicationCard
      name="Example API"
      description="Click to view details"
      contextType="Core System"
      onClick={() => handleApiClick('example-api')}
    />
  );
}

/**
 * Example 6: Conditional Rendering with Library Components
 */
export function ConditionalRenderingExample() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  if (isLoading) {
    return <Typography>Loading APIs...</Typography>;
  }

  if (hasError) {
    return (
      <Box>
        <Typography color="error">Failed to load APIs</Typography>
        <Button 
          variant="contained" 
          color="error"
          onClick={() => setHasError(false)}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <ApplicationCard
      name="API"
      description="Loaded successfully"
      contextType="Core System"
      onClick={() => {}}
    />
  );
}

/**
 * Example 7: Creating a Custom Hook for API Operations
 */
function useApi() {
  const [apis, setApis] = React.useState<ApplicationCardProps[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    // Fetch your API data
    fetch('/api/list')
      .then(r => r.json())
      .then(data => setApis(data))
      .finally(() => setLoading(false));
  }, []);

  return { apis, loading };
}

/**
 * Example 8: Complete Page Using Library Components
 */
export function ApiCatalogPage() {
  const { apis, loading } = useApi();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          API Catalog
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Browse and integrate Komatsu APIs
        </Typography>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <Button variant="contained">Request API</Button>
        <Button variant="outlined">View Documentation</Button>
      </Box>

      {/* API List - Using Library Component */}
      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <ApplicationList applications={apis} />
      )}

      {/* Footer Section */}
      <Box sx={{ mt: 4, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="body2" color="textSecondary">
          Need help? Check our documentation or contact support.
        </Typography>
      </Box>
    </Container>
  );
}

// ============================================================================
// INTEGRATION CHECKLIST
// ============================================================================
//
// ✅ Import components from '@komatsu-nagm/component-library'
// ✅ Import types/interfaces (ApplicationCardProps, etc.)
// ✅ Use proper TypeScript types for props
// ✅ Implement required callbacks (onClick, onOpen, etc.)
// ✅ Provide required props (name, description, contextType, etc.)
// ✅ Style with MUI sx prop for consistency
// ✅ Handle loading and error states in your component
// ✅ Test components thoroughly before deploying
//
// ============================================================================
// COMMON PATTERNS
// ============================================================================
//
// Pattern 1: Display a list of items
//   Use ApplicationList with array of ApplicationCardProps
//
// Pattern 2: Single card with click handler
//   Use ApplicationCard with onClick callback to navigate
//
// Pattern 3: Styled buttons in a form
//   Use Button component with variant and color props
//
// Pattern 4: Conditional component display
//   Check loading/error state before rendering
//
// Pattern 5: Integration with routing
//   Use navigate() callback to handle card clicks
//
// ============================================================================

// Re-export everything for your application
export { 
  ButtonExample, 
  ApplicationCardExample, 
  ApiCatalogExample,
  StyledComponentExample,
  RouterIntegrationExample,
  ConditionalRenderingExample,
  ApiCatalogPage
};

// Import the necessary hooks if using routing
import { useNavigate } from 'react-router-dom';
