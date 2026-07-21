import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  Calendar,
  Check,
  Download,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
} from "lucide-react";

import {
  chatPlanItinerary,
  generateItinerary,
  getPlaceIdeasForSlot,
  reviseItineraryFromEdits,
  submitPlanLead,
  type Itinerary,
  type ItineraryActivity,
  type PlaceIdea,
} from "@/lib/itinerary.functions";
import { AmbientVideo } from "@/components/ambient-video";
import { useSession } from "@/lib/auth";
import { createPlanTextDownload, listSavedPlansByOwner, upsertSavedPlan } from "@/lib/saved-plans";

const TIERS = [
  { id: "budget", name: "Budget-Friendly", price: "$", body: "Hostels, transit, street food." },
  { id: "mid", name: "Mid-Range", price: "$$", body: "Boutique stays, curated dining." },
  { id: "premium", name: "Premium", price: "$$$", body: "Luxury, private guides, VIP." },
  { id: "custom", name: "Custom", price: "?", body: "Blend your own experience." },
] as const;

const searchSchema = z.object({
  tier: z.enum(["budget", "mid", "premium", "custom"]).optional(),
});

const CATEGORIES: ItineraryActivity["category"][] = [
  "Tourist Attraction",
  "Local Event",
  "Cultural Heritage",
  "Fun Activity",
  "Dining",
  "Rest",
];

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Trip Planner — Ephemera" },
      {
        name: "description",
        content:
          "Chat with AI to create a real-time trip plan, edit each day with place suggestions and images, then save and submit your plan.",
      },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: Planner,
});

type ChatTurn = { role: "user" | "assistant"; content: string };

const PLANNER_VIDEO =
  "https://player.vimeo.com/external/403449271.sd.mp4?s=2e8f38efcaee5e4eb784762b5f18e5eb9f444572&profile_id=165&oauth2_token_id=57447761";
const FALLBACK_MEDIA = "/media/travel-fallback.svg";

const PLANNER_IMAGES = [
  "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1200&q=80",
];

function Planner() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useSession();

  const generate = useServerFn(generateItinerary);
  const chatPlan = useServerFn(chatPlanItinerary);
  const getPlaceIdeas = useServerFn(getPlaceIdeasForSlot);
  const reviseItinerary = useServerFn(reviseItineraryFromEdits);
  const submitLead = useServerFn(submitPlanLead);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(4);
  const [travelers, setTravelers] = useState(1);
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>(search.tier ?? "mid");
  const [prompt, setPrompt] = useState("");

  const [chatDraft, setChatDraft] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);

  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [revising, setRevising] = useState(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

  const [ideasLoadingForDay, setIdeasLoadingForDay] = useState<number | null>(null);
  const [placeIdeasByDay, setPlaceIdeasByDay] = useState<Record<number, PlaceIdea[]>>({});
  const [leadPhone, setLeadPhone] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [adminReference, setAdminReference] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);

  const canGenerate = destination.trim().length > 0 && days > 0 && travelers > 0;

  const plannerStats = useMemo(() => {
    if (!itinerary) return null;
    const activities = itinerary.days.reduce((acc, day) => acc + day.activities.length, 0);
    return {
      days: itinerary.days.length,
      activities,
    };
  }, [itinerary]);

  async function handleGenerateClassic() {
    if (!user) {
      toast.info("Sign in to generate and save itinerary.");
      navigate({ to: "/auth" });
      return;
    }
    if (!canGenerate) {
      toast.error("Please enter destination, days and travelers.");
      return;
    }

    setLoading(true);
    try {
      const result = await generate({
        data: { destination: destination.trim(), days, travelers, tier, prompt: prompt.trim() || undefined },
      });
      setItinerary(result);
      toast.success("AI trip plan generated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatPlan() {
    if (!user) {
      toast.info("Sign in to use AI chat planning.");
      navigate({ to: "/auth" });
      return;
    }

    const content = chatDraft.trim();
    if (!content) {
      toast.error("Type your trip request first.");
      return;
    }

    const nextHistory: ChatTurn[] = [...chatHistory, { role: "user", content }];
    setChatHistory(nextHistory);
    setChatDraft("");
    setChatLoading(true);

    try {
      const result = await chatPlan({
        data: {
          messages: nextHistory,
          tierHint: tier,
          travelersHint: travelers,
        },
      });

      setChatHistory((prev) => [...prev, { role: "assistant", content: result.assistantMessage }]);
      setDestination(result.extracted.destination);
      setDays(result.extracted.days);
      setTravelers(result.extracted.travelers);
      setTier(result.extracted.tier);
      setPrompt(result.extracted.prompt);
      setItinerary(result.itinerary);
      toast.success("Real-time itinerary drafted from chat.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not process chat plan.";
      toast.error(msg);
    } finally {
      setChatLoading(false);
    }
  }

  function updateDayField(dayIndex: number, field: "title" | "summary", value: string) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const daysCopy = [...prev.days];
      daysCopy[dayIndex] = { ...daysCopy[dayIndex], [field]: value };
      return { ...prev, days: daysCopy };
    });
  }

  function updateActivity(dayIndex: number, activityIndex: number, patch: Partial<ItineraryActivity>) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const daysCopy = [...prev.days];
      const day = daysCopy[dayIndex];
      const activities = [...day.activities];
      activities[activityIndex] = { ...activities[activityIndex], ...patch };
      daysCopy[dayIndex] = { ...day, activities };
      return { ...prev, days: daysCopy };
    });
  }

  function removeActivity(dayIndex: number, activityIndex: number) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const daysCopy = [...prev.days];
      const day = daysCopy[dayIndex];
      const activities = day.activities.filter((_, idx) => idx !== activityIndex);
      daysCopy[dayIndex] = { ...day, activities };
      return { ...prev, days: daysCopy };
    });
  }

  function addManualActivity(dayIndex: number) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const daysCopy = [...prev.days];
      const day = daysCopy[dayIndex];
      const activities = [
        ...day.activities,
        {
          time: "Flexible",
          title: "New stop",
          category: "Fun Activity",
          description: "Add what you want to do here.",
        } satisfies ItineraryActivity,
      ];
      daysCopy[dayIndex] = { ...day, activities };
      return { ...prev, days: daysCopy };
    });
  }

  async function loadPlaceIdeas(dayIndex: number) {
    if (!itinerary) return;

    setIdeasLoadingForDay(dayIndex);
    try {
      const day = itinerary.days[dayIndex];
      const result = await getPlaceIdeas({
        data: {
          destination: itinerary.destination,
          dayTitle: day.title,
          existingActivityTitles: day.activities.map((a) => a.title),
        },
      });
      setPlaceIdeasByDay((prev) => ({ ...prev, [dayIndex]: result.ideas }));
      toast.success("Place ideas loaded with images.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not fetch place ideas.";
      toast.error(msg);
    } finally {
      setIdeasLoadingForDay(null);
    }
  }

  function addIdeaToDay(dayIndex: number, idea: PlaceIdea) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const daysCopy = [...prev.days];
      const day = daysCopy[dayIndex];
      const activities = [
        ...day.activities,
        {
          time: idea.bestTime || "Flexible",
          title: idea.title,
          category: idea.category,
          description: idea.whyVisit,
        } satisfies ItineraryActivity,
      ];
      daysCopy[dayIndex] = { ...day, activities };
      return { ...prev, days: daysCopy };
    });
  }

  async function handleAiRevise() {
    if (!itinerary) return;
    setRevising(true);

    try {
      const instruction =
        prompt.trim() ||
        "Refine this trip after edits. Optimize route flow, diversify activities and keep realistic timings.";

      const revised = await reviseItinerary({ data: { itinerary, instruction } });
      setItinerary(revised);
      toast.success("AI updated itinerary based on your edits.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not revise itinerary.";
      toast.error(msg);
    } finally {
      setRevising(false);
    }
  }

  function downloadPlan() {
    if (!itinerary) return;
    const content = createPlanTextDownload(itinerary);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${itinerary.destination.replace(/\s+/g, "-").toLowerCase()}-itinerary.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Plan downloaded.");
  }

  async function saveAndNotifyAdmin() {
    if (!user) {
      toast.info("Sign in to save your plan.");
      navigate({ to: "/auth" });
      return;
    }
    if (!itinerary) {
      toast.error("Generate a plan first.");
      return;
    }
    if (savingLead) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setSavingLead(true);

    try {
      const lead = await submitLead({
        data: {
          user: {
            name: user.name,
            email: user.email,
            phone: leadPhone.trim() || undefined,
          },
          itinerary,
          notes: leadNotes.trim() || undefined,
        },
      });

      upsertSavedPlan({
        id,
        ownerEmail: user.email,
        createdAt: now,
        updatedAt: now,
        itinerary,
        notes: leadNotes.trim() || undefined,
        adminReferenceId: lead.referenceId,
      });

      setAdminReference(lead.referenceId);
      toast.success(
        lead.delivered
          ? "Plan saved. Admin team notified for callback."
          : "Plan saved. Admin webhook not configured yet.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      toast.error(msg);
    } finally {
      setSavingLead(false);
    }
  }

  const savedCount = user ? listSavedPlansByOwner(user.email).length : 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <header className="space-y-4 animate-rise ambient-panel rounded-3xl p-2 md:p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Smart Planner // Realtime AI + Edits + Admin Lead
        </div>
        <h1 className="text-4xl md:text-6xl font-serif leading-[0.92] max-w-4xl">
          Chat, build, edit, and finalize your trip.
        </h1>
        <p className="max-w-3xl text-muted-foreground leading-relaxed">
          Tell the AI your destination and trip length. It will generate a real-time itinerary that you can edit by
          adding or removing activities, enrich with place suggestions and images, then save or download while sending
          an admin callback request for costing.
        </p>
      </header>

      <section className="grid xl:grid-cols-12 gap-8 items-start cinematic-frame p-2 md:p-3">
        <AmbientVideo src={PLANNER_VIDEO} posterSrc={FALLBACK_MEDIA} />

        <div className="xl:col-span-5 space-y-6 animate-reveal">
          <div className="p-6 glass-card rounded-2xl shadow-sm space-y-5 planner-grid-bg ambient-panel">
            <div className="flex items-center gap-2 text-accent font-mono text-xs uppercase tracking-wider">
              <MessageSquare className="size-4" /> AI Chat Input
            </div>

            <textarea
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              rows={4}
              placeholder="Example: I am traveling to Jaipur with my family for 4 days. Please include kid-friendly activities."
              className="w-full bg-transparent border border-border rounded-lg p-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 text-sm"
            />

            <button
              type="button"
              onClick={handleChatPlan}
              disabled={chatLoading}
              className="w-full bg-linear-to-r from-primary to-accent text-accent-foreground py-3 rounded-xl font-mono uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-sm"
            >
              {chatLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Planning from chat...
                </>
              ) : (
                <>
                  <Bot className="size-4" /> Generate via chat
                </>
              )}
            </button>

            {chatHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-background/65 p-4 space-y-3 max-h-72 overflow-y-auto">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {msg.role}
                    </div>
                    <p>{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 glass-card rounded-2xl shadow-sm space-y-5 animate-reveal [animation-delay:120ms]">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Manual Planner Inputs</div>

            <Field label="Destination" icon={<MapPin className="size-3.5" />}>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Goa, India"
                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 font-serif text-xl italic placeholder:text-muted-foreground/60"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Duration (days)" icon={<Calendar className="size-3.5" />}>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                />
              </Field>
              <Field label="Travelers" icon={<Users className="size-3.5" />}>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={travelers}
                  onChange={(e) => setTravelers(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                />
              </Field>
            </div>

            <Field label="AI notes" icon={<Sparkles className="size-3.5" />}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Vegetarian, less walking, sunset points, avoid too crowded areas"
                className="w-full bg-transparent border-b border-border py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 text-sm resize-none placeholder:text-muted-foreground/60"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              {TIERS.map((t) => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`ticket-cutout text-left p-4 rounded-lg border transition-all ${
                      active
                        ? "border-primary bg-background/80 ring-2 ring-primary/70"
                        : "border-border bg-background/70 hover:-translate-y-1"
                    }`}
                  >
                    <div className="flex justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t.id}</div>
                      <div className="font-semibold text-accent">{t.price}</div>
                    </div>
                    <h4 className="font-serif text-lg mt-1">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">{t.body}</p>
                    {active && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase text-accent">
                        <Check className="size-3" /> Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleGenerateClassic}
              disabled={loading || !canGenerate}
              className="w-full bg-linear-to-r from-primary to-accent text-accent-foreground py-3 rounded-xl font-mono uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <WandSparkles className="size-4" /> Generate from form
                </>
              )}
            </button>

            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                Please <Link to="/auth" className="text-accent underline underline-offset-2">sign in</Link> to use AI planner.
              </p>
            )}
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6 animate-reveal [animation-delay:180ms]">
          <div className="grid sm:grid-cols-2 gap-3">
            {PLANNER_IMAGES.map((src, idx) => (
              <div key={idx} className="cinematic-frame h-36 glass-card">
                <img
                  src={src}
                  alt="Trip visual"
                  className="w-full h-full object-cover image-pan"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_MEDIA;
                  }}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                <div className="absolute left-3 bottom-3 text-white font-mono text-[10px] uppercase tracking-widest">
                  Inspiration {idx + 1}
                </div>
              </div>
            ))}
          </div>

          {itinerary ? (
            <section className="space-y-6">
              <div className="flex flex-wrap justify-between items-end border-b-2 border-dashed border-border pb-4 gap-3">
                <div>
                  <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    Editable Itinerary // {itinerary.tier.toUpperCase()} // {itinerary.travelers} traveler(s)
                  </div>
                  <div className="font-serif italic text-3xl mt-1">{itinerary.destination}</div>
                </div>
                {plannerStats && (
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Summary</div>
                    <div className="text-sm">{plannerStats.days} days • {plannerStats.activities} activities</div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {itinerary.days.map((d, dayIndex) => (
                  <article key={d.day} className="glass-card p-5 rounded-xl day-card-animate">
                    <div className="flex items-start justify-between gap-4">
                      <div className="font-mono text-accent w-14 shrink-0">
                        <div className="text-2xl font-bold">{String(d.day).padStart(2, "0")}</div>
                        <div className="text-[10px] uppercase tracking-wider opacity-70">Day</div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <input
                          value={d.title}
                          onChange={(e) => updateDayField(dayIndex, "title", e.target.value)}
                          className="w-full bg-transparent border-b border-border py-1 text-xl font-serif focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                        />
                        <textarea
                          value={d.summary}
                          onChange={(e) => updateDayField(dayIndex, "summary", e.target.value)}
                          rows={2}
                          className="w-full bg-transparent border-b border-border py-1 text-sm text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 resize-none"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 border-l border-dashed border-border pl-4">
                      {d.activities.map((a, activityIndex) => (
                        <div key={activityIndex} className="grid md:grid-cols-[90px_1fr_auto] gap-3 items-start rounded-lg p-3 hover:bg-background/72 transition-colors">
                          <input
                            value={a.time}
                            onChange={(e) => updateActivity(dayIndex, activityIndex, { time: e.target.value })}
                            className="bg-transparent border-b border-border py-1 font-mono text-[11px] uppercase tracking-wider focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                          />

                          <div className="space-y-2">
                            <input
                              value={a.title}
                              onChange={(e) => updateActivity(dayIndex, activityIndex, { title: e.target.value })}
                              className="w-full bg-transparent border-b border-border py-1 font-serif text-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                            />
                            <select
                              value={a.category}
                              onChange={(e) =>
                                updateActivity(dayIndex, activityIndex, {
                                  category: e.target.value as ItineraryActivity["category"],
                                })
                              }
                              className="bg-background border border-border rounded px-2 py-1 text-[11px] font-mono uppercase"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={a.description}
                              onChange={(e) => updateActivity(dayIndex, activityIndex, { description: e.target.value })}
                              rows={2}
                              className="w-full bg-transparent border-b border-border py-1 text-sm text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 resize-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeActivity(dayIndex, activityIndex)}
                            className="text-destructive hover:opacity-80 transition-opacity p-2"
                            aria-label="Remove activity"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addManualActivity(dayIndex)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider hover:border-accent"
                      >
                        <Plus className="size-3.5" /> Add activity
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPlaceIdeas(dayIndex)}
                        disabled={ideasLoadingForDay === dayIndex}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider hover:border-accent disabled:opacity-50"
                      >
                        {ideasLoadingForDay === dayIndex ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Loading ideas
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3.5" /> Suggest places + images
                          </>
                        )}
                      </button>
                    </div>

                    {placeIdeasByDay[dayIndex]?.length ? (
                      <div className="mt-4 grid sm:grid-cols-2 gap-3">
                        {placeIdeasByDay[dayIndex].map((idea, idx) => (
                          <div key={`${idea.title}-${idx}`} className="rounded-lg border border-border bg-background/85 overflow-hidden glass-card">
                            {idea.imageUrl ? (
                              <img
                                src={idea.imageUrl}
                                alt={idea.title}
                                className="w-full h-28 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_MEDIA;
                                }}
                              />
                            ) : (
                              <div className="w-full h-28 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                No image found
                              </div>
                            )}
                            <div className="p-3 space-y-2">
                              <div className="font-serif text-lg leading-tight">{idea.title}</div>
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                                {idea.category} • {idea.bestTime}
                              </div>
                              <p className="text-xs text-muted-foreground">{idea.whyVisit}</p>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => addIdeaToDay(dayIndex, idea)}
                                  className="inline-flex items-center gap-1 bg-linear-to-r from-primary to-accent text-accent-foreground px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider hover:opacity-90"
                                >
                                  <Plus className="size-3" /> Add to day
                                </button>
                                {idea.imageSourceUrl && (
                                  <a
                                    href={idea.imageSourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-mono uppercase tracking-wider text-accent hover:opacity-80"
                                  >
                                    Source
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {itinerary.tips.length > 0 && (
                <div className="bg-foreground text-background rounded-xl p-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">Field notes</div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {itinerary.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-4 space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Re-Plan</div>
                  <p className="text-sm text-muted-foreground">
                    AI will optimize your itinerary after edits for better sequence and practical day flow.
                  </p>
                  <button
                    type="button"
                    onClick={handleAiRevise}
                    disabled={revising}
                    className="w-full bg-linear-to-r from-primary to-accent text-accent-foreground py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {revising ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Revising...
                      </>
                    ) : (
                      <>
                        <WandSparkles className="size-4" /> Apply AI revision
                      </>
                    )}
                  </button>
                </div>

                <div className="glass-card rounded-xl p-4 space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Save, Download & Admin Callback
                  </div>

                  <input
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                  />

                  <textarea
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    rows={2}
                    placeholder="Extra request for costing/call (optional)"
                    className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 resize-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={downloadPlan}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider hover:border-accent"
                    >
                      <Download className="size-3.5" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={saveAndNotifyAdmin}
                      disabled={savingLead}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-linear-to-r from-primary to-accent text-accent-foreground px-3 py-2 text-xs font-mono uppercase tracking-wider hover:opacity-90"
                    >
                      {savingLead ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" /> Save + Notify
                        </>
                      )}
                    </button>
                  </div>

                  {adminReference && (
                    <p className="text-xs text-muted-foreground">
                      Admin request reference: <span className="font-mono text-accent">{adminReference}</span>
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">Saved plans in your profile: {savedCount}</p>
                </div>
              </div>
            </section>
          ) : (
            <div className="glass-card rounded-2xl p-10 text-center space-y-3">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">No itinerary yet</div>
              <h2 className="font-serif text-3xl italic">Start with chat or form.</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Start with a chat request (for example, a 4-day Goa trip) or fill in the form manually. Your generated
                itinerary will be fully editable.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
