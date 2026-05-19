export type PromptTemplate =
  | "company-summary"
  | "outreach-email"
  | "follow-up-email"
  | "project-brief";

export function getPromptPurpose(template: PromptTemplate): string {
  switch (template) {
    case "company-summary":
      return "Summarize the company profile for partner qualification.";
    case "outreach-email":
      return "Generate a personalized first-touch email draft.";
    case "follow-up-email":
      return "Generate a polite follow-up email draft.";
    case "project-brief":
      return "Generate a structured student project brief.";
  }
}

