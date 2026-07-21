import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, User, LogOut } from "lucide-react";
import { useSession } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, signOut } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-full transition-all ${
        pathname === to
          ? "text-accent bg-accent/14"
          : "hover:text-accent hover:bg-accent/8"
      }`}
    >
      {label}
    </Link>
  );

  const initials = (user?.name ?? "JD")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/55 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
            Ephemera.
          </Link>
          <div className="hidden md:flex gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground glass-card rounded-full px-2 py-1">
            {navLink("/", "Explore")}
            {navLink("/planner", "Planner")}
            {user && navLink("/profile", "My Logs")}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            aria-label="Settings"
            className="p-2 hover:bg-foreground/6 rounded-full transition-colors"
          >
            <Settings className="size-4" />
          </Link>
          <div className="h-6 w-px bg-border" />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account"
                  className="size-9 bg-linear-to-br from-primary to-accent rounded-full flex items-center justify-center text-accent-foreground text-[10px] font-mono font-semibold shadow-md"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="font-mono text-[10px] uppercase tracking-widest bg-linear-to-r from-primary to-accent text-accent-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity shadow-sm"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
