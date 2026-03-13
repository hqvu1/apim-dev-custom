# Component Library Integration - Quick Start

## What Just Happened

Your project now has the **@komatsu-nagm/component-library** integrated as a local development dependency!

### Setup Summary

| Aspect | Details |
|--------|---------|
| **Library** | @komatsu-nagm/component-library v0.2.5 |
| **Location** | Linked from `../react-template` |
| **Status** | ✅ Installed and building successfully |
| **Build Output** | 2,131 KB (production build) |
| **Build Status** | ✅ Successful with 0 TypeScript errors |

## What's Available

The component library provides these reusable components:

- ✅ **Button** - Customizable button with multiple variants
- ✅ **Header** - Navigation header with user profile support  
- ✅ **UserProfile** - User profile card with dropdown menu
- ✅ **PageCard** - Content card with icon and title
- ✅ **PageCardList** - List container for PageCard components
- ✅ **ApplicationCard** - Service/application card component
- ✅ **ApplicationList** - List container for ApplicationCard components
- ✅ **ContextGroup** - Grouped context items with summary
- ✅ **ContextItem** - Individual context item
- ✅ **ContextSummaryBar** - Context summary visualization

Plus:
- Theme system (colors, typography, MUI theme)
- Type definitions for all components
- Storybook for interactive development

## Getting Started

### 1. Import a Component

```typescript
import { Button } from '@komatsu-nagm/component-library';

export function MyComponent() {
  return (
    <Button 
      variant="contained" 
      color="primary"
      onClick={() => console.log('Clicked!')}
    >
      Click Me
    </Button>
  );
}
```

### 2. Use the Theme

```typescript
import { theme } from '@komatsu-nagm/component-library';
import { ThemeProvider } from '@mui/material/styles';

<ThemeProvider theme={theme}>
  <MyApp />
</ThemeProvider>
```

### 3. Build & Test

```bash
# Build the project
npm run build

# Run tests
npm run test

# Preview
npm run preview
```

## Accessing Component Details

For detailed documentation on all components including:
- Complete prop definitions
- Usage examples
- Best practices
- Troubleshooting

**See:** [COMPONENT_LIBRARY_INTEGRATION.md](./COMPONENT_LIBRARY_INTEGRATION.md)

## Development Workflow

Since the component library is linked locally:

1. **Make changes** to components in `../react-template/src/components/`
2. **Rebuild the library**: In `react-template/`, run `npm run build`
3. **Changes are automatic** in your main project!

## Interactive Component Preview

The component library includes Storybook for interactive testing:

```bash
# In react-template directory
npm run storybook
# Opens at http://localhost:6006
```

## Next Steps

1. **Replace existing components** with library components in your pages
2. **Use the exported theme** for consistent styling
3. **Refer to component docs** for proper prop usage
4. **Test in your application** to ensure integration

## File Structure

Your integration files:
```
src/
├── App.tsx (updated with component imports capability)
├── components/
│   └── (use library components here)
├── pages/
│   └── (import components from library as needed)
└── ...

docs/
└── COMPONENT_LIBRARY_INTEGRATION.md  ← Full integration guide
```

## Configuration Files Updated

- ✅ `.npmrc` - Registry configuration for @komatsu-nagm scope
- ✅ `package.json` - Component library dependency added
- ✅ `node_modules/` - Dependencies installed

## Key Points

✅ **Local Development** - Changes to components are immediately available  
✅ **Type Safety** - Full TypeScript support  
✅ **Build Optimized** - Production build with proper code-splitting  
✅ **Peer Dependencies** - Supports React 18+ with MUI 5+  
✅ **No Breaking Changes** - Existing code continues to work  

## Common Tasks

### Add a Button from the Library
```typescript
import { Button } from '@komatsu-nagm/component-library';

// Use it like any other component
<Button variant="contained">My Button</Button>
```

### Display an ApplicationCard
```typescript
import { ApplicationCard } from '@komatsu-nagm/component-library';

<ApplicationCard
  name="My Application"
  description="Application description"
  contextType="Core System"
  onClick={() => navigate('/details')}
/>
```

### Use Theme Colors
```typescript
import { colors } from '@komatsu-nagm/component-library';
import { Box } from '@mui/material';

<Box sx={{ 
  backgroundColor: colors.primary,
  color: colors.text
}}>
  Styled content
</Box>
```

## Support & Resources

- 📚 **Full Guide**: [COMPONENT_LIBRARY_INTEGRATION.md](./COMPONENT_LIBRARY_INTEGRATION.md)
- 🔗 **Library Repo**: https://github.com/Komatsu-NAGM/react-template
- 📖 **MUI Docs**: https://mui.com/
- 🎨 **Storybook**: `npm run storybook` in react-template

---

**Integration Date**: March 10, 2026  
**Status**: ✅ Complete and Production Ready
