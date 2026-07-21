import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { MapPin, Calendar, Sparkles } from "lucide-react";
import { listSavedPlansByOwner, type SavedPlan } from "@/lib/saved-plans";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Ephemera" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

function Profile() {
  const { user, hydrated } = useSession();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/auth" });
  }, [hydrated, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const load = () => setPlans(listSavedPlansByOwner(user.email));
    load();
    window.addEventListener("ephemera:saved-plans", load);
    return () => window.removeEventListener("ephemera:saved-plans", load);
  }, [user]);

  if (!user) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Redirecting to sign in…
        </p>
      </main>
    );
  }

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
      <header className="animate-reveal">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Traveler Log // Profile
        </div>
        <div className="mt-6 flex items-center gap-6">
          <div className="size-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-mono text-2xl font-semibold">
            {initials}
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-serif italic">{user.name}</h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-2">
              {user.email}
            </p>
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-4 animate-reveal">
        <Stat label="Journals drafted" value={String(plans.length)} />
        <Stat label="Countries logged" value="—" />
        <Stat
          label="Member since"
          value={new Date(user.joinedAt).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        />
      </section>

      <section className="space-y-4 animate-reveal">
        <div className="flex justify-between items-end border-b-2 border-dashed border-border pb-3">
          <h2 className="font-serif italic text-2xl">Saved journals</h2>
          <Link
            to="/planner"
            className="font-mono text-[10px] uppercase tracking-widest text-accent hover:opacity-80"
          >
            + New journal
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="bg-card ring-1 ring-border rounded-xl p-12 text-center space-y-4">
            <Sparkles className="size-6 mx-auto text-accent" />
            <h3 className="font-serif text-2xl">Your archive is empty.</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Every generated itinerary will appear here once you save it. Start by drafting your first journal.
            </p>
            <Link
              to="/planner"
              className="inline-flex items-center gap-2 bg-foreground text-background py-3 px-6 rounded-xl font-mono text-xs uppercase tracking-widest hover:bg-accent transition-colors"
            >
              Draft a new trip
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <article key={plan.id} className="bg-card ring-1 ring-border rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-2xl italic">{plan.itinerary.destination}</h3>
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
                      {plan.itinerary.days.length} days • {plan.itinerary.travelers} traveler(s) • {plan.itinerary.tier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Saved {new Date(plan.updatedAt).toLocaleDateString()}
                    </p>
                    {plan.adminReferenceId && (
                      <p className="text-[11px] font-mono text-accent mt-1">Ref: {plan.adminReferenceId}</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-4 animate-reveal">
        <InfoCard icon={<MapPin className="size-4" />} label="Home base" value="Not set" />
        <InfoCard icon={<Calendar className="size-4" />} label="Next trip" value="Not scheduled" />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card ring-1 ring-border rounded-xl p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-serif text-4xl mt-2">{value}</div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card ring-1 ring-border rounded-xl p-6 flex items-center gap-4">
      <div className="size-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-serif text-lg mt-0.5">{value}</div>
      </div>
    </div>
  );
}
