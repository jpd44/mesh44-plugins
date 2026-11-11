import { AccountView } from "@/components/AccountView";
import { SignedInShell } from "@/components/SignedInShell";

// Lazy-load from App.tsx at /account (the UserMenu's Profile and Change password links point here).
export default function AccountPage() {
  return (
    <SignedInShell appName="{{APP_NAME}}">
      <main className="mx-auto max-w-2xl px-6 py-10">
        <AccountView />
      </main>
    </SignedInShell>
  );
}
