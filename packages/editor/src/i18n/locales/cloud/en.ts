const en = {
  loading: {
    initializing: "Initializing...",
  },
  error: {
    title: "Something went wrong",
    defaultMessage:
      "The editor could not connect to Templatical. Check your network connection and try again.",
    authFailed: "Authentication failed. Please check your credentials.",
    templateNotFound:
      "The requested template could not be found. Please verify the template ID is correct.",
    retry: "Try Again",
  },
  header: {
    templatesUsed: "{used}/{max} templates used",
  },
  aiChat: {
    title: "AI Assistant",
    button: "AI",
    inputPlaceholder: "Describe your email template...",
    applied: "Changes applied to template.",
    applyFailed: "Could not apply changes to template. Please try again.",
    revert: "Revert changes",
    reapply: "Re-apply changes",
    error: "Failed to generate template",
    clear: "Clear chat",
    placeholder:
      "Describe the email template you want to create, or ask to modify the current one.",
    loadingHistory: "Loading conversation...",
  },
  scoring: {
    title: "Template Score",
    rescore: "Re-score",
    scoring: "Analyzing template...",
    overallScore: "Overall Score",
    categories: {
      spam: "Spam Risk",
      readability: "Readability",
      accessibility: "Accessibility",
      bestPractices: "Best Practices",
    },
    severity: {
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    fix: "Fix with AI",
    fixing: "Fixing...",
    findings: "findings",
    noFindings: "No issues found",
    error: "Failed to analyze template",
    fixError: "Failed to apply fix",
    emptyState:
      "Score your template to get actionable feedback on spam risk, readability, accessibility, and best practices.",
  },
  aiMenu: {
    aiAssistant: "AI Assistant",
    aiAssistantDesc: "Chat with AI to create or modify your template",
    designToTemplate: "Design to Template",
    designToTemplateDesc: "Generate a template from an image or PDF",
    templateScore: "Template Score",
    templateScoreDesc: "Analyze quality, spam risk, and accessibility",
    disclaimer: "AI can make mistakes. Please verify before approving.",
  },
  collaboration: {
    connected: "Collaboration mode active",
    disconnected: "Collaboration disconnected",
  },
  designReference: {
    title: "Design Reference",
    uploadImage: "Image",
    uploadPdf: "PDF",
    dropHint: "Drop a file here or click to browse",
    acceptedImages: "PNG, JPG, WebP (max 10MB)",
    acceptedPdf: "PDF (max 10MB)",
    promptLabel: "Instructions (optional)",
    promptPlaceholder:
      "Describe any adjustments or preferences for the generated template...",
    generate: "Generate from design",
    generating: "Analyzing design and generating template...",
    replaceWarning:
      "Generating from a design reference will replace the existing template content.",
    replaceConfirm: "Replace and generate",
    replaceCancel: "Cancel",
    error: "Failed to generate template from design",
    fileTooLarge: "File is too large. Maximum size is 10MB.",
    invalidFileType:
      "This file type is not supported. Upload a PNG, JPG, WebP, or PDF.",
  },

  saveGate: {
    title: "Accessibility errors block this save",
    body: "Your plan blocks saves while errors remain. Fix the items below or save anyway.",
    cancel: "Review and fix",
    confirm: "Save anyway",
  },
};

export default en;
