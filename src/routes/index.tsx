import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, MapPin, ScrollText, Compass, BookOpen, Wallet, Feather, Quote } from "lucide-react";


const SAMPLE_DAYS = [
  {
    n: "01",
    day: "Monday",
    title: "Morning Mist at Arashiyama",
    body: "Begin at the Bamboo Grove before the crowds. AI suggests Ouka Coffee for a seasonal hand-brew.",
    tags: ["CULTURE", "NATURE"],
    active: true,
  },
  {
    n: "02",
    day: "Tuesday",
    title: "Philosopher's Path & Tea",
    body: "A contemplative walk through Higashiyama. Evening: local jazz haunt 'Yamatoya'.",
    tags: ["HERITAGE", "MUSIC"],
    active: false,
  },
  {
    n: "03",
    day: "Wednesday",
    title: "Fushimi Inari at Dawn",
    body: "Ten thousand torii gates in silence. Return via a family-run udon shop tucked in the hillside.",
    tags: ["ATTRACTION", "FOOD"],
    active: false,
  },
];

const TIERS = [
  {
    code: "CLASS_01",
    name: "Budget-Friendly",
    price: "$",
    tag: "budget",
    body: "Hidden gems, local transit, and street-food narratives.",
    items: ["AI Transit Maps", "Hostel Curations", "Free Walking Tours"],
  },
  {
    code: "CLASS_02",
    name: "Mid-Range",
    price: "$$",
    tag: "mid",
    body: "Boutique stays, rhythmic dining, and local heritage sites.",
    items: ["Ryokan Bookings", "Workshop Entry", "Curated Dining"],
    featured: true,
  },
  {
    code: "CLASS_03",
    name: "Premium",
    price: "$$$",
    tag: "premium",
    body: "Luxury escapes, private guides, and sensory indulgence.",
    items: ["Chauffeur Service", "5-Star Logs", "VIP Site Access"],
  },
  {
    code: "CLASS_XX",
    name: "Custom",
    price: "?",
    tag: "custom",
    body: "Tell the AI your weirdest dreams and we'll map them.",
    items: ["Anything You Want"],
    dark: true,
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ephemera — AI Trip Journals & Itineraries" },
      {
        name: "description",
        content:
          "AI-crafted travel itineraries that feel like hand-annotated journals. Plan your next unfolding story.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="w-full px-8 py-12 space-y-24">
      {/* Hero + live preview */}
      <section className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-8 animate-reveal">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            AI Travel Journals // Est. 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-serif italic text-balance leading-[0.9]">
            Plan your next
            <br />
            unfolding story.
          </h1>
          <p className="max-w-[38ch] text-muted-foreground text-lg">
            AI-crafted itineraries that feel like hand-annotated journals. Attractions, culture, local events,
            and fun — one uniquely-plotted day at a time.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/planner"
              className="inline-flex items-center gap-2 bg-foreground text-background py-3 px-6 rounded-xl font-mono text-xs uppercase tracking-widest hover:bg-accent transition-all active:scale-95"
            >
              Start planning <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 border border-border py-3 px-6 rounded-xl font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent transition-colors"
            >
              Sign in
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-border">
            <Feature icon={<Sparkles className="size-4" />} label="AI-authored" />
            <Feature icon={<MapPin className="size-4" />} label="Any destination" />
            <Feature icon={<ScrollText className="size-4" />} label="Day-by-day" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6 animate-reveal [animation-delay:150ms]">
          <div className="flex justify-between items-end border-b-2 border-dashed border-border pb-4">
            <div className="font-mono text-xs text-muted-foreground">LIVE PREVIEW // LOG_082</div>
            <div className="font-serif italic text-2xl">Kyoto: The Zen Path</div>
          </div>

          <div className="space-y-4">
            {SAMPLE_DAYS.map((d) => (
              <div
                key={d.n}
                className={`bg-card p-6 rounded-xl ring-1 ring-border flex gap-6 transition-all ${
                  d.active ? "hover:ring-accent/30" : "opacity-60"
                }`}
              >
                <div className={`font-mono shrink-0 ${d.active ? "text-accent" : "text-muted-foreground"}`}>
                  <div className="text-2xl font-bold">{d.n}</div>
                  <div className="text-[10px] uppercase tracking-tighter opacity-60">{d.day}</div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-serif text-xl">{d.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.body}</p>
                  <div className="flex gap-2 flex-wrap">
                    {d.tags.map((t) => (
                      <span key={t} className="px-2 py-1 bg-background text-[10px] font-mono rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="space-y-12 animate-reveal">
        <div className="text-center space-y-2">
          <h2 className="font-serif text-3xl italic">Select your fare class</h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            Curated depth levels for every traveler
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIERS.map((t) => (
            <Link
              key={t.code}
              to="/planner"
              search={{ tier: t.tag } as never}
              className={`ticket-cutout p-8 rounded-lg space-y-6 hover:-translate-y-2 transition-transform relative block ${
                t.dark
                  ? "bg-foreground text-background"
                  : t.featured
                  ? "bg-card border-2 border-accent"
                  : "bg-card border border-border"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-mono px-3 py-1 rounded-full uppercase tracking-widest">
                  Recommended
                </span>
              )}
              <div className="flex justify-between items-start">
                <div className={`font-mono text-xs ${t.dark ? "opacity-60" : "text-muted-foreground"}`}>
                  {t.code}
                </div>
                <div className="text-accent font-bold text-xl">{t.price}</div>
              </div>
              <div>
                <h4 className="font-serif text-2xl">{t.name}</h4>
                <p className={`text-xs mt-2 ${t.dark ? "opacity-60" : "text-muted-foreground"}`}>{t.body}</p>
              </div>
              <div
                className={`pt-4 border-t border-dashed ${
                  t.dark ? "border-background/20" : "border-border"
                }`}
              >
                <div
                  className={`text-[10px] font-mono uppercase ${
                    t.dark ? "opacity-60" : "text-muted-foreground"
                  }`}
                >
                  Included:
                </div>
                <ul className="text-[11px] space-y-1 mt-2 font-medium opacity-80 uppercase tracking-tight">
                  {t.items.map((it) => (
                    <li key={it}>• {it}</li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="grid md:grid-cols-3 gap-6 animate-reveal">
        {[
          {
            n: "01",
            title: "Describe your journey",
            body: "Destination, days, travelers. Add a prompt if the muse strikes.",
          },
          {
            n: "02",
            title: "Choose your fare class",
            body: "Budget, mid-range, premium, or a fully custom blend.",
          },
          {
            n: "03",
            title: "Receive your journal",
            body: "A day-by-day plan of attractions, culture, events, and fun.",
          },
        ].map((s) => (
          <div key={s.n} className="p-6 border-t border-border">
            <div className="font-mono text-xs text-accent">STEP_{s.n}</div>
            <h3 className="font-serif text-2xl mt-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-foreground text-background rounded-3xl overflow-hidden animate-reveal">
        <div className="p-12 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl font-serif italic">Save your wandering thoughts.</h2>
            <p className="opacity-70 max-w-[36ch]">
              Create an account to save generated journals, revisit past trips, and sync with your logbook.
            </p>
          </div>
          <div className="flex md:justify-end">
            <Link
              to="/planner"
              className="inline-flex items-center gap-2 bg-accent text-accent-foreground py-4 px-8 rounded-lg font-mono uppercase tracking-widest text-sm hover:opacity-90 transition-opacity"
            >
              Draft an itinerary <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-tight text-muted-foreground">
      <span className="text-accent">{icon}</span>
      {label}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="pt-12 border-t border-border flex flex-col md:flex-row justify-between items-start gap-8">
      <div className="space-y-2">
        <span className="font-serif italic text-2xl">Ephemera.</span>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-tighter">
          © 2026 Digital Artifacts Co.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-16">
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Navigation</div>
          <ul className="space-y-2 text-sm font-medium">
            <li>
              <Link to="/planner" className="hover:text-accent transition-colors">
                Planner
              </Link>
            </li>
            <li>
              <Link to="/profile" className="hover:text-accent transition-colors">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="hover:text-accent transition-colors">
                Settings
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Account</div>
          <ul className="space-y-2 text-sm font-medium">
            <li>
              <Link to="/auth" className="hover:text-accent transition-colors">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
