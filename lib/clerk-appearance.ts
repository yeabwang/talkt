// Clerk auth styling mapped to the TalkT design tokens.
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
    // Match the TalkT field style with the taller auth input height.
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
