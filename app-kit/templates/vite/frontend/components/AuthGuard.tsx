import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { LoginForm } from "./LoginForm";

/** Renders children when signed in; otherwise the login card. `login` configures it (appName, icon, allowSignUp). */
export function AuthGuard({ children, login }: { children: ReactNode; login: ComponentProps<typeof LoginForm> }) {
  const { email, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking your session…
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <LoginForm {...login} />
      </div>
    );
  }

  return <>{children}</>;
}
