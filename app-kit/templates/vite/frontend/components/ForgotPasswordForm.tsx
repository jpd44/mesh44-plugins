import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { confirmPassword, forgotPassword } from "@/lib/auth";

export function ForgotPasswordForm({
  initialEmail = "",
  onDone,
  onCancel,
}: {
  initialEmail?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a reset code");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmPassword(email, code, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    await sendCode();
    setInfo("Code resent. Check your email.");
  }

  if (step === "request") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your account email and we'll send you a reset code.</CardDescription>
        </CardHeader>
        <form onSubmit={onRequest}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset code"}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={onCancel}>
              Back to sign in
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          If <span className="font-medium">{email}</span> has an account, we've emailed it a 6-digit code.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onConfirm}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-code">Reset code</Label>
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 10 characters, with upper and lower case letters and a number.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Resetting…" : "Reset password"}
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={onResend} disabled={submitting}>
            Resend code
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
