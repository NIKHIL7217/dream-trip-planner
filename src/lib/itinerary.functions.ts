import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TierEnum = z.enum(["budget", "mid", "premium", "custom"]);

const InputSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  days: z.number().int().min(1).max(30),
  travelers: z.number().int().min(1).max(50),
  tier: TierEnum,
  prompt: z.string().trim().max(1000).optional(),
});

export type ItineraryInput = z.infer<typeof InputSchema>;

export type ItineraryActivity = {
  time: string;
  title: string;
  category: string;
  description: string;
};

export type ItineraryDay = {
  day: number;
  title: string;
  summary: string;
  activities: ItineraryActivity[];
};

export type Itinerary = {
  destination: string;
  tier: z.infer<typeof TierEnum>;
  travelers: number;
  days: ItineraryDay[];
  tips: string[];
};

export type PlaceIdea = {
  title: string;
  category: ItineraryActivity["category"];
  whyVisit: string;
  bestTime: string;
  imageUrl?: string;
  imageSourceUrl?: string;
};

const TIER_BRIEF: Record<z.infer<typeof TierEnum>, string> = {
  budget:
    "Budget-Friendly ($): hostels/guesthouses, street food, public transit, free heritage sites and walking tours.",
  mid: "Mid-Range ($$): boutique hotels, local bistros, curated guided experiences, workshops, and comfortable transit.",
  premium:
    "Premium ($$$): luxury stays, private guides, chauffeur transfers, Michelin-tier or renowned restaurants, VIP access.",
  custom:
    "Custom: balance quirky/off-beat experiences with the user's own prompt. Prioritize personalization.",
};

const ItineraryActivitySchema = z.object({
  time: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
});

const ItineraryDaySchema = z.object({
  day: z.number(),
  title: z.string(),
  summary: z.string(),
  activities: z.array(ItineraryActivitySchema),
});

const ItinerarySchema = z.object({
  destination: z.string(),
  tier: TierEnum,
  travelers: z.number(),
  days: z.array(ItineraryDaySchema),
  tips: z.array(z.string()),
});

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1500),
});

const ChatPlanInputSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(20),
  tierHint: TierEnum.optional(),
  travelersHint: z.number().int().min(1).max(50).optional(),
});

const PlaceIdeasInputSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  dayTitle: z.string().trim().min(1).max(180),
  existingActivityTitles: z.array(z.string().trim().max(200)).max(20).default([]),
  query: z.string().trim().max(200).optional(),
});

const ReviseItineraryInputSchema = z.object({
  itinerary: ItinerarySchema,
  instruction: z.string().trim().min(1).max(1500),
});

const LeadInputSchema = z.object({
  user: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(40).optional(),
  }),
  itinerary: ItinerarySchema,
  notes: z.string().trim().max(1500).optional(),
});

type GatewayPayload = {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  responseFormatJson?: boolean;
};

const AI_KEY_ENV_NAMES = ["TRIP_AI_API_KEY", "VITE_GEMINI_API_KEY", "LOVABLE_API_KEY"] as const;
const ADMIN_WEBHOOK_ENV_NAMES = ["ADMIN_PLAN_WEBHOOK_URL", "VITE_ADMIN_PLAN_WEBHOOK_URL"] as const;
const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_MAX_RETRIES = 2;

function firstEnvValue(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function getApiKey(): string {
  const key = firstEnvValue(AI_KEY_ENV_NAMES);
  if (!key) {
    throw new Error(
      `Missing AI key. Set TRIP_AI_API_KEY (preferred) or one of: ${AI_KEY_ENV_NAMES.join(", ")}`,
    );
  }
  return key;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

async function postJsonWithRetry(url: string, body: unknown, retries: number): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        WEBHOOK_TIMEOUT_MS,
      );

      if (!shouldRetryStatus(res.status) || attempt === retries) {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
    }

    const backoffMs = 300 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Webhook request failed after retries.");
}

async function callGateway({
  model = "google/gemini-3.5-flash",
  messages,
  responseFormatJson,
}: GatewayPayload): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": getApiKey(),
    },
    body: JSON.stringify({
      model,
      messages,
      ...(responseFormatJson ? { response_format: { type: "json_object" as const } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy — please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI returned malformed JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeTier(value: unknown, fallback: Itinerary["tier"]): Itinerary["tier"] {
  if (value === "budget" || value === "mid" || value === "premium" || value === "custom") return value;
  return fallback;
}

function normalizeCategory(value: unknown): ItineraryActivity["category"] {
  const categories: ItineraryActivity["category"][] = [
    "Tourist Attraction",
    "Local Event",
    "Cultural Heritage",
    "Fun Activity",
    "Dining",
    "Rest",
  ];
  return categories.includes(value as ItineraryActivity["category"])
    ? (value as ItineraryActivity["category"])
    : "Fun Activity";
}

function coerceItinerary(parsed: unknown, fallback: ItineraryInput): Itinerary {
  const p = parsed as Partial<Itinerary>;
  const days = Array.isArray(p.days)
    ? p.days
        .map((day, idx) => {
          const raw = day as Partial<ItineraryDay>;
          const activities = Array.isArray(raw.activities)
            ? raw.activities.map((a) => {
                const aa = a as Partial<ItineraryActivity>;
                return {
                  time: String(aa.time ?? "Flexible"),
                  title: String(aa.title ?? "Explore"),
                  category: normalizeCategory(aa.category),
                  description: String(aa.description ?? "Enjoy the local vibe."),
                } satisfies ItineraryActivity;
              })
            : [];

          return {
            day: Number(raw.day ?? idx + 1),
            title: String(raw.title ?? `Day ${idx + 1}`),
            summary: String(raw.summary ?? "A balanced day of exploration."),
            activities,
          } satisfies ItineraryDay;
        })
        .slice(0, fallback.days)
    : [];

  return {
    destination: typeof p.destination === "string" && p.destination.trim() ? p.destination : fallback.destination,
    tier: normalizeTier(p.tier, fallback.tier),
    travelers: Number.isFinite(p.travelers) ? Number(p.travelers) : fallback.travelers,
    days,
    tips: Array.isArray(p.tips) ? p.tips.map((tip) => String(tip)).slice(0, 8) : [],
  };
}

async function lookupWikiImage(place: string, destination: string): Promise<{
  imageUrl?: string;
  imageSourceUrl?: string;
}> {
  const searches = [`${place} ${destination}`, place];

  for (const search of searches) {
    const openRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        search,
      )}&limit=1&namespace=0&format=json`,
    );
    if (!openRes.ok) continue;

    const openData = (await openRes.json()) as [string, string[]];
    const title = openData?.[1]?.[0];
    if (!title) continue;

    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!summaryRes.ok) continue;

    const summary = (await summaryRes.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };

    const imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source;
    if (imageUrl) {
      return {
        imageUrl,
        imageSourceUrl: summary.content_urls?.desktop?.page,
      };
    }
  }

  return {};
}

export const generateItinerary = createServerFn({ method: "POST" })
  .validator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<Itinerary> => {
    const system = `You are a meticulous travel journal author. You write day-by-day itineraries that feel like hand-annotated journals — specific place names, atmospheric detail, and a mix of tourist attractions, local events, cultural/heritage sites, and fun activities. Every day is unique. Output STRICT JSON only, no prose, no markdown fences.`;

    const userPrompt = `Plan a trip to "${data.destination}" for ${data.days} day(s) for ${data.travelers} traveler(s).
Fare class: ${TIER_BRIEF[data.tier]}
${data.prompt ? `Additional user notes: ${data.prompt}` : ""}

Return JSON matching EXACTLY this TypeScript type:
{
  "destination": string,
  "tier": "budget" | "mid" | "premium" | "custom",
  "travelers": number,
  "days": Array<{
    "day": number,
    "title": string,          // evocative title for the day (e.g. "Morning Mist at Arashiyama")
    "summary": string,        // 1-2 sentences framing the day
    "activities": Array<{
      "time": string,         // e.g. "07:30" or "Morning"
      "title": string,        // specific place or experience
      "category": "Tourist Attraction" | "Local Event" | "Cultural Heritage" | "Fun Activity" | "Dining" | "Rest",
      "description": string   // 1-3 sentences, journal voice, atmospheric
    }>
  }>,
  "tips": string[]            // 3-5 practical local tips tailored to the tier
}
Include 4-6 activities per day, mixing categories. Do not repeat places across days. Use real, well-known and lesser-known places for ${data.destination}.`;

    const content = await callGateway({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      responseFormatJson: true,
    });

    const parsed = safeJsonParse(content);
    return coerceItinerary(parsed, data);
  });

export const chatPlanItinerary = createServerFn({ method: "POST" })
  .validator((raw: unknown) => ChatPlanInputSchema.parse(raw))
  .handler(async ({ data }) => {
    const system = `You are an interactive travel planner. Parse the user chat, infer destination, days, travelers, and preferences, then produce a complete itinerary JSON. Output STRICT JSON only.`;

    const conversation = data.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const userPrompt = `Conversation:\n${conversation}

Infer:
- destination (required)
- days (1..30)
- travelers (1..50)
- tier (budget|mid|premium|custom, use "${data.tierHint ?? "mid"}" if unclear)
- notes

Return EXACT JSON:
{
  "assistantMessage": string,
  "extracted": {
    "destination": string,
    "days": number,
    "travelers": number,
    "tier": "budget" | "mid" | "premium" | "custom",
    "prompt": string
  },
  "itinerary": {
    "destination": string,
    "tier": "budget" | "mid" | "premium" | "custom",
    "travelers": number,
    "days": Array<{
      "day": number,
      "title": string,
      "summary": string,
      "activities": Array<{
        "time": string,
        "title": string,
        "category": "Tourist Attraction" | "Local Event" | "Cultural Heritage" | "Fun Activity" | "Dining" | "Rest",
        "description": string
      }>
    }>,
    "tips": string[]
  }
}

Rules:
- Ensure days exactly match extracted.days.
- Include 4-6 activities each day.
- Use real places/experiences in inferred destination.
- assistantMessage should be warm and concise.`;

    const content = await callGateway({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      responseFormatJson: true,
    });

    const parsed = safeJsonParse(content) as {
      assistantMessage?: unknown;
      extracted?: Partial<ItineraryInput>;
      itinerary?: unknown;
    };

    const extracted = {
      destination:
        typeof parsed.extracted?.destination === "string" && parsed.extracted.destination.trim()
          ? parsed.extracted.destination.trim()
          : "",
      days: Math.max(1, Math.min(30, Number(parsed.extracted?.days ?? 4) || 4)),
      travelers: Math.max(
        1,
        Math.min(50, Number(parsed.extracted?.travelers ?? data.travelersHint ?? 1) || 1),
      ),
      tier: normalizeTier(parsed.extracted?.tier, data.tierHint ?? "mid"),
      prompt: typeof parsed.extracted?.prompt === "string" ? parsed.extracted.prompt.trim() : "",
    } satisfies ItineraryInput;

    if (!extracted.destination) {
      throw new Error("AI could not detect destination. Please mention city/country in chat.");
    }

    const itinerary = coerceItinerary(parsed.itinerary, extracted);

    return {
      assistantMessage:
        typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
          ? parsed.assistantMessage.trim()
          : `I drafted a ${extracted.days}-day itinerary for ${extracted.destination}.`,
      extracted,
      itinerary,
    };
  });

export const getPlaceIdeasForSlot = createServerFn({ method: "POST" })
  .validator((raw: unknown) => PlaceIdeasInputSchema.parse(raw))
  .handler(async ({ data }): Promise<{ ideas: PlaceIdea[] }> => {
    const system = `You suggest real places and experiences for itinerary edits. Return JSON only.`;
    const userPrompt = `Destination: ${data.destination}
Day context: ${data.dayTitle}
Current activities: ${data.existingActivityTitles.join(", ") || "None"}
User focus: ${data.query || "Balanced mix"}

Return EXACT JSON:
{
  "ideas": Array<{
    "title": string,
    "category": "Tourist Attraction" | "Local Event" | "Cultural Heritage" | "Fun Activity" | "Dining" | "Rest",
    "whyVisit": string,
    "bestTime": string
  }>
}

Rules:
- 6 ideas.
- Use real places/events in or around ${data.destination}.
- Avoid repeating current activities.`;

    const content = await callGateway({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      responseFormatJson: true,
    });

    const parsed = safeJsonParse(content) as { ideas?: Array<Partial<PlaceIdea>> };
    const baseIdeas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 6) : [];

    const ideas = await Promise.all(
      baseIdeas.map(async (idea) => {
        const title = String(idea.title ?? "Local Experience");
        const media = await lookupWikiImage(title, data.destination).catch(() => ({}));

        return {
          title,
          category: normalizeCategory(idea.category),
          whyVisit: String(idea.whyVisit ?? "Great local option to enrich your day."),
          bestTime: String(idea.bestTime ?? "Flexible"),
          imageUrl: media.imageUrl,
          imageSourceUrl: media.imageSourceUrl,
        } satisfies PlaceIdea;
      }),
    );

    return { ideas };
  });

export const reviseItineraryFromEdits = createServerFn({ method: "POST" })
  .validator((raw: unknown) => ReviseItineraryInputSchema.parse(raw))
  .handler(async ({ data }): Promise<Itinerary> => {
    const system = `You are an expert trip optimizer. Improve an edited itinerary while preserving user intent and structure. Output JSON only.`;
    const userPrompt = `Current itinerary JSON:\n${JSON.stringify(data.itinerary)}

User instruction: ${data.instruction}

Return the same JSON shape with improvements:
- Keep destination, days count, and major user changes.
- Improve sequencing, travel flow, and activity balance.
- Keep activities specific and realistic.
- Keep tips practical and updated.
- Output JSON only.`;

    const content = await callGateway({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      responseFormatJson: true,
    });

    const parsed = safeJsonParse(content);
    return coerceItinerary(parsed, {
      destination: data.itinerary.destination,
      days: data.itinerary.days.length,
      travelers: data.itinerary.travelers,
      tier: data.itinerary.tier,
      prompt: data.instruction,
    });
  });

export const submitPlanLead = createServerFn({ method: "POST" })
  .validator((raw: unknown) => LeadInputSchema.parse(raw))
  .handler(async ({ data }) => {
    const referenceId = `EPH-${Date.now().toString(36).toUpperCase()}`;
    const webhook = firstEnvValue(ADMIN_WEBHOOK_ENV_NAMES);

    if (!webhook) {
      return {
        delivered: false,
        referenceId,
        message:
          `Lead saved on user side. Configure ${ADMIN_WEBHOOK_ENV_NAMES[0]} to notify admin in real time.`,
      };
    }

    const payload = {
      referenceId,
      submittedAt: new Date().toISOString(),
      user: data.user,
      notes: data.notes,
      itinerary: data.itinerary,
      summary: {
        destination: data.itinerary.destination,
        days: data.itinerary.days.length,
        travelers: data.itinerary.travelers,
        tier: data.itinerary.tier,
      },
    };

    const res = await postJsonWithRetry(webhook, payload, WEBHOOK_MAX_RETRIES);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Admin notification failed (${res.status}): ${text.slice(0, 140)}`);
    }

    return {
      delivered: true,
      referenceId,
      message: "Admin notification sent successfully.",
    };
  });
