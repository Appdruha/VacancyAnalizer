import type { DashboardData, DashboardSummary } from "../types.js";

export function buildSummary(data: DashboardData): DashboardSummary {
  return {
    industries: data.bootstrap.summary.industries,
    companies: data.bootstrap.summary.companies,
    contacts: data.bootstrap.summary.contacts,
    jobs: data.bootstrap.summary.jobs,
    vacancies: data.bootstrap.data.vacancies.length,
    sources: data.bootstrap.data.sources.length,
    ingestionRuns: data.bootstrap.data.ingestionRuns.length,
    shortlisted: data.shortlist.items.length,
    drafts: data.drafts.items.length,
    approvedDrafts: data.drafts.items.filter((item) => item.approved).length,
    campaigns: data.bootstrap.data.campaigns.length,
    messages: data.messages.items.length,
    replies: data.replies.items.length,
    escalatedReplies: data.replies.items.filter((item) => item.escalated).length,
    agreements: data.bootstrap.data.agreements.length,
    briefs: data.bootstrap.data.briefs.length,
    communicationPackages: data.communicationPackages.items.length,
    memoryEvents: data.memoryOverview.eventCount
  };
}
