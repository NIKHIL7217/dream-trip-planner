import type { Itinerary } from "@/lib/itinerary.functions";

export type SavedPlan = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ownerEmail: string;
  itinerary: Itinerary;
  notes?: string;
  adminReferenceId?: string;
};

const SAVED_PLANS_KEY = "ephemera.saved-plans";

export function loadSavedPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedPlans(plans: SavedPlan[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(plans));
  window.dispatchEvent(new CustomEvent("ephemera:saved-plans"));
}

export function upsertSavedPlan(plan: SavedPlan) {
  const all = loadSavedPlans();
  const idx = all.findIndex((p) => p.id === plan.id);

  if (idx >= 0) {
    all[idx] = plan;
  } else {
    all.unshift(plan);
  }

  saveSavedPlans(all);
}

export function listSavedPlansByOwner(email: string): SavedPlan[] {
  return loadSavedPlans().filter((plan) => plan.ownerEmail.toLowerCase() === email.toLowerCase());
}

export function createPlanTextDownload(plan: Itinerary): string {
  const lines: string[] = [];
  lines.push(`Destination: ${plan.destination}`);
  lines.push(`Tier: ${plan.tier}`);
  lines.push(`Travelers: ${plan.travelers}`);
  lines.push("");

  for (const day of plan.days) {
    lines.push(`Day ${day.day}: ${day.title}`);
    lines.push(day.summary);
    for (const activity of day.activities) {
      lines.push(`- ${activity.time} | ${activity.title} (${activity.category})`);
      lines.push(`  ${activity.description}`);
    }
    lines.push("");
  }

  if (plan.tips.length > 0) {
    lines.push("Tips:");
    for (const tip of plan.tips) lines.push(`- ${tip}`);
  }

  return lines.join("\n");
}
