# Komatsu Component Library Integration Guide

## Overview

The project now integrates the **@komatsu-nagm/component-library** - a reusable React component library built with Material-UI (MUI) designed to match the Komatsu Digital Office Design Template.

### Library Details
- **Package Name**: `@komatsu-nagm/component-library`
- **Version**: 0.2.5
- **Location**: Local reference via `../react-template`
- **Built with**: React 18+, MUI 5+, TypeScript, Vite
- **Repository**: https://github.com/Komatsu-NAGM/react-template

## Installation Status

✅ **Component library is installed and linked locally**

The library is referenced in `package.json` as:
```json
{
  "dependencies": {
    "@komatsu-nagm/component-library": "file:../react-template"
  }
}
```

## Available Components

The component library exports the following components:

### 1. **Button**
A customizable button component with multiple variants.

```typescript
import { Button } from '@komatsu-nagm/component-library';

// Usage
<Button 
  variant="contained" 
  color="primary"
  onClick={handleClick}
>
  Click Me
</Button>
```

**Props:**
- `variant`: 'contained' | 'outlined' | 'text'
- `color`: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info'
- `size`: 'small' | 'medium' | 'large'
- `onClick`: () => void
- Standard MUI Button props

---

### 2. **PageCard**
A card component for displaying page content with icon and title.

```typescript
import { PageCard } from '@komatsu-nagm/component-library';

// Usage
<PageCard
  title="API Documentation"
  description="Complete API reference guide"
  icon={<DocumentIcon />}
  onOpen={() => console.log('Opened')}
  showBeta={false}
  accessRequired={false}
/>
```

**Props:**
- `title`: string (required)
- `description`: string (required)
- `icon`: React.ReactNode (required)
- `onOpen`: () => void (required)
- `showBeta?`: boolean
- `accessRequired?`: boolean
- `accessRequiredMessage?`: string

---

### 3. **PageCardList**
A list component for displaying multiple PageCard components.

```typescript
import { PageCardList } from '@komatsu-nagm/component-library';

<PageCardList
  cards={[
    { title: 'Card 1', description: 'Desc 1', icon: <Icon1 />, onOpen: () => {} },
    { title: 'Card 2', description: 'Desc 2', icon: <Icon2 />, onOpen: () => {} }
  ]}
/>
```

---

### 4. **Header**
Navigation header component with user profile support.

```typescript
import { Header } from '@komatsu-nagm/component-library';

// Usage
<Header
  navigationItems={[
    { label: 'Home', href: '/' },
    { label: 'APIs', href: '/apis' }
  ]}
/>
```

**Props:**
- `navigationItems?`: NavigationItem[]
- Standard MUI AppBar props

---

### 5. **UserProfile**
User profile component with dropdown menu support.

```typescript
import { UserProfile } from '@komatsu-nagm/component-library';

// Usage
<UserProfile
  userName="John Doe"
  userEmail="john@example.com"
  menuItems={[
    { label: 'Profile', onClick: () => {} },
    { label: 'Settings', onClick: () => {} },
    { label: 'Logout', onClick: () => {} }
  ]}
/>
```

**Props:**
- `userName?`: string
- `userEmail?`: string
- `menuItems?`: UserProfileMenuItem[]
- `avatar?`: React.ReactNode

---

### 6. **ApplicationCard**
Card component for displaying application/service information.

```typescript
import { ApplicationCard } from '@komatsu-nagm/component-library';

// Usage
<ApplicationCard
  name="Warranty API"
  description="Access warranty database and coverage information"
  contextType="Core System"
  statusIndicators={[
    { icon: <ErrorIcon />, tooltip: 'Active' }
  ]}
  onClick={() => navigate('/apis/warranty')}
/>
```

**Props:**
- `name`: string (required)
- `description`: string (required)
- `contextType`: ContextType (required) - one of: 'Core System', 'Core Technology', 'Domain Solution', 'Legacy', 'Emerging', 'Other'
- `icon?`: React.ReactNode
- `statusIndicators?`: StatusIndicator[]
- `onClick?`: () => void

---

### 7. **ApplicationList**
List component for displaying multiple ApplicationCard components.

```typescript
import { ApplicationList } from '@komatsu-nagm/component-library';

// Usage
<ApplicationList
  applications={[
    {
      id: '1',
      name: 'Warranty API',
      description: 'Warranty information',
      contextType: 'Core System',
      // ... other properties
    }
  ]}
/>
```

---

### 8. **ContextGroup**
Grouped display of context items with summary.

```typescript
import { ContextGroup } from '@komatsu-nagm/component-library';

// Usage
<ContextGroup
  title="System Context"
  items={[
    { name: 'Environment', value: 'Production', type: 'Core System' },
    { name: 'Region', value: 'North America', type: 'Core Technology' }
  ]}
  summary={[
    { type: 'Core System', count: 1 },
    { type: 'Core Technology', count: 1 }
  ]}
/>
```

**Props:**
- `title`: string (required)
- `items`: ContextItemProps[] (required)
- `summary`: ContextSummary[] (required)
- `onExpand?`: () => void
- `initialItemCount?`: number (default: 5)

---

### 9. **ContextItem**
Individual context item component (used within ContextGroup).

```typescript
import { ContextItem } from '@komatsu-nagm/component-library';

// Usage
<ContextItem
  name="Environment"
  value="Production"
  type="Core System"
/>
```

**Props:**
- `name`: string (required)
- `value`: string (required)
- `type`: ContextType (required)

---

### 10. **ContextSummaryBar**
Summary bar for context items.

```typescript
import { ContextSummaryBar } from '@komatsu-nagm/component-library';

// Usage
<ContextSummaryBar
  summary={[
    { type: 'Core System', count: 5 },
    { type: 'Emerging', count: 2 }
  ]}
/>
```

---

## Theme Integration

The component library exports theme and color utilities:

```typescript
import { theme, colors, typography } from '@komatsu-nagm/component-library';
import { ThemeProvider } from '@mui/material/styles';

// Apply theme to your app
<ThemeProvider theme={theme}>
  <YourApp />
</ThemeProvider>
```

**Available Exports:**
- `theme`: Complete MUI theme configuration
- `colors`: Color token definitions
- `typography`: Typography token definitions
- `ThemeProvider`: MUI ThemeProvider component
- `CssBaseline`: MUI CssBaseline component

## Best Practices

1. **Type Safety**: Always import type definitions for props:
   ```typescript
   import { Button, type ButtonProps } from '@komatsu-nagm/component-library';
   ```

2. **Theme Consistency**: Use the exported theme from the library:
   ```typescript
   import { theme } from '@komatsu-nagm/component-library';
   ```

3. **Component Composition**: Build complex UIs by combining components:
   ```typescript
   <ApplicationList applications={apps}>
     {/* List handles rendering of ApplicationCard components */}
   </ApplicationList>
   ```

4. **Prop Validation**: Always provide required props to avoid TypeScript errors

5. **Event Handlers**: Use callbacks for user interactions:
   ```typescript
   <ApplicationCard 
     onClick={() => handleCardClick(id)}
     // ... other props
   />
   ```

## Development Workflow

### Working with Local Library

Since the component library is referenced locally via `file:../react-template`:

1. **Make changes** to components in `../react-template/src/components/`
2. **Rebuild the library** in react-template: `npm run build`
3. **Changes are automatically reflected** in the main project

### Storybook Preview

The component library includes Storybook for interactive component development:

```bash
# In react-template directory
npm run storybook
```

This opens an interactive UI at `http://localhost:6006` to preview and test all components.

## Testing Components

The component library includes tests for all components. To run tests:

```bash
# In react-template directory
npm run test           # Run tests
npm run test:ui       # Run with UI
npm run test:coverage # Generate coverage report
```

## Common Integration Patterns

### Pattern 1: Using ApplicationList
```typescript
import { ApplicationList } from '@komatsu-nagm/component-library';

function ApiCatalog() {
  const [apis] = useState([
    {
      id: '1',
      name: 'Warranty API',
      description: 'Access warranty information',
      contextType: 'Core System',
      // ... other properties
    }
  ]);

  return <ApplicationList applications={apis} />;
}
```

### Pattern 2: Custom Button Styling
```typescript
import { Button } from '@komatsu-nagm/component-library';
import { styled } from '@mui/material/styles';

const StyledButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

<StyledButton variant="contained">Custom Button</StyledButton>
```

### Pattern 3: Theme Customization
```typescript
import { theme as baseTheme } from '@komatsu-nagm/component-library';
import { createTheme } from '@mui/material/styles';

const customTheme = createTheme({
  ...baseTheme,
  palette: {
    primary: {
      main: '#your-color'
    }
  }
});
```

## Troubleshooting

### Build Errors with Component Library

If you encounter type errors when using components:

1. **Verify imports**: Check that you're importing from the correct package
   ```typescript
   // ✅ Correct
   import { Button } from '@komatsu-nagm/component-library';
   
   // ❌ Incorrect
   import { Button } from '@komatsu-nagm/component-library/src';
   ```

2. **Check prop types**: Ensure all required props are provided
   ```typescript
   // Review the component interface before using
   import type { ApplicationCardProps } from '@komatsu-nagm/component-library';
   ```

3. **Rebuild if needed**: After updating the library
   ```bash
   cd ../react-template
   npm run build
   cd ../kx-apim-dev-custom
   npm install
   npm run build
   ```

## Next Steps

1. **Replace existing components** in your pages with library components
2. **Use the theme** exported from the library for consistency
3. **Test components** thoroughly in different scenarios
4. **Contribute improvements** back to the react-template repository

## Resources

- **Component Library Repo**: https://github.com/Komatsu-NAGM/react-template
- **Komatsu Design System**: [Design system documentation from Figma]
- **MUI Documentation**: https://mui.com/
- **React Documentation**: https://react.dev/

## Support

For issues or questions about the component library:

1. Check the react-template repository for existing issues
2. Review component Storybook entries for usage examples
3. Check component TypeScript definitions for available props
4. Contact the development team for integration support
