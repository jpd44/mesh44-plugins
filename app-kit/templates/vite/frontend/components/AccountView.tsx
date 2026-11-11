import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, changePassword } from "@/lib/auth";
import { useAuth } from "./AuthProvider";

/** Profile page body: account details, change password (anchor #password), sign out. */
export function AccountView() {
  const { email, signOut } = useAuth();
  const passwordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === "#password") passwordRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and sign-in details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-medium">{email}</p>
        </CardContent>
      </Card>

      <Card id="password" ref={passwordRef} className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Enter your current password, then the new one twice.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Signs you out on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              signOut();
              window.location.assign("/");
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <PasswordField id="current-password" label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} />
      <PasswordField id="new-password" label="New password" autoComplete="new-password" value={next} onChange={setNext} minLength={10} />
      <PasswordField id="confirm-password" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} minLength={10} />
      <p className="text-xs text-muted-foreground">At least 10 characters, with upper and lower case letters and a number.</p>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700">
          Password changed.
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Change password
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" required value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
