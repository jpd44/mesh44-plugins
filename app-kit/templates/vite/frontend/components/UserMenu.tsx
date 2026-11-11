import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, KeyRound, LogOut, User } from "lucide-react";
import { useAuth } from "./AuthProvider";

export type UserMenuItem = { label: string; href: string; icon: ReactNode };

/** Avatar + email button for the top-right of the header; opens the account menu. */
export function UserMenu({ accountHref = "/account", items = [] }: { accountHref?: string; items?: UserMenuItem[] }) {
  const { email, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!email) return null;
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border bg-card/70 py-1 pr-2.5 pl-1 text-sm shadow-sm transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${email}`}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden max-w-40 truncate text-muted-foreground sm:inline">{email}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border bg-card p-1 shadow-lg">
          <div className="border-b px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
          <MenuItem icon={<User className="size-4" />} href={accountHref}>
            Profile
          </MenuItem>
          {items.map((it) => (
            <MenuItem key={it.href} icon={it.icon} href={it.href}>
              {it.label}
            </MenuItem>
          ))}
          <MenuItem icon={<KeyRound className="size-4" />} href={`${accountHref}#password`}>
            Change password
          </MenuItem>
          <MenuItem
            icon={<LogOut className="size-4" />}
            onClick={() => {
              setOpen(false);
              signOut();
              window.location.assign("/");
            }}
          >
            Sign out
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, href, onClick, children }: { icon: ReactNode; href?: string; onClick?: () => void; children: ReactNode }) {
  const cls =
    "flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{children}</span>
    </>
  );
  return href ? (
    <a role="menuitem" href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button role="menuitem" type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
