// Auth UI pulls every color from the TalkT design tokens in globals.css —
// no hardcoded hex. Sharp 0-radius + Geist to match the design system.
export const authAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "var(--background)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorBorder: "var(--border)",
    colorInput: "var(--input)",
    colorDanger: "var(--destructive)",
    borderRadius: "0",
    fontFamily: "var(--font-geist-sans)",
  },
  options: {
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    // Mirror the TalkT `.field` style (globals.css) but with a taller box.
    formFieldInput: {
      width: "100%",
      height: "48px",
      padding: "0 14px",
      fontSize: "15px",
      backgroundColor: "var(--card)",
      color: "var(--foreground)",
      border: "1px solid color-mix(in srgb, var(--foreground) 32%, transparent)",
      borderRadius: "0",
      boxShadow: "none",
      "&:focus": {
        borderColor: "var(--border-focus)",
        boxShadow: "0 0 0 1px var(--border-focus)",
      },
    },
    formFieldLabel: {
      fontFamily: "var(--font-geist-mono)",
      fontSize: "11px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--muted-foreground)",
    },
  },
};
