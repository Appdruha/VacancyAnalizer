export function classifyReplyCategory(input: string): {
  category: "interest" | "decline" | "question" | "meeting";
  positive: boolean;
  summary: string;
} {
  const normalized = input.trim().toLowerCase();

  if (/(meeting|call|discuss|calendar|next week|demo)/.test(normalized)) {
    return {
      category: "meeting",
      positive: true,
      summary: "The contact is open to a meeting or a direct follow-up discussion."
    };
  }

  if (/(interested|sounds good|let'?s talk|partnership|relevant|curious)/.test(normalized)) {
    return {
      category: "interest",
      positive: true,
      summary: "The contact expressed interest in exploring a partnership."
    };
  }

  if (/(not interested|no thanks|decline|not relevant|pass)/.test(normalized)) {
    return {
      category: "decline",
      positive: false,
      summary: "The contact declined the current outreach."
    };
  }

  return {
    category: "question",
    positive: false,
    summary: "The contact replied with a question or requested clarification."
  };
}
