/**
 * Theme configuration — delegates to @komatsu-nagm/component-library.
 *
 * The component library provides the canonical Komatsu Digital Office theme
 * (colors, typography, spacing) based on the Figma design template.
 * Re-exporting here keeps the rest of the SPA's imports unchanged.
 *
 * @see https://github.com/Komatsu-NAGM/react-template
 */
// The library barrel exports `theme` as a named export (re-exported from ./theme/index.ts default).
export { theme, colors, typography } from "@komatsu-nagm/component-library";
export type { ColorTokens, TypographyTokens } from "@komatsu-nagm/component-library";
