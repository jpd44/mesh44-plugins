import type { ReactNode } from "react";
import { AuthGuard } from "./AuthGuard";
import { AuthProvider } from "./AuthProvider";
import { UserMenu, type UserMenuItem } from "./UserMenu";

/**
 * Wrap every signed-in page in this: login gate first, then a header with the app name on the left and the
 * account dropdown (Profile, Change password, Sign out, plus `menuItems`) in the top-right corner.
 * Set allowSignUp={false} when the user pool is invite-only (selfSignUpEnabled: false).
 */
export function SignedInShell({
  appName,
  icon,
  allowSignUp = true,
  menuItems,
  children,
}: {
  appName: string;
  icon?: ReactNode;
  allowSignUp?: boolean;
  menuItems?: UserMenuItem[];
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard login={{ appName, icon, allowSignUp }}>
        <div className="min-h-svh">
          <header className="flex items-center justify-between border-b bg-card px-6 py-3">
            <a href="/" className="font-heading text-lg font-semibold">{appName}</a>
            <UserMenu items={menuItems} />
          </header>
          {children}
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
