import { useState, type ReactNode } from "react";
import type { CognitoUser } from "amazon-cognito-identity-js";
import { Eye, EyeOff, Loader2, Lock, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NewPasswordRequiredError,
  authErrorMessage,
  confirmPassword,
  confirmSignUp,
  forgotPassword,
  resendConfirmationCode,
  signUp,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

type Mode = "signIn" | "signUp" | "confirm" | "forgot" | "resetPassword" | "newPassword";

type Props = {
  /** Shown in the subheading, e.g. "Sign in to my-app.". */
  appName: string;
  /** Badge at the top of the card. */
  icon?: ReactNode;
  /** Offer "Create an account". Turn off for invite-only pools (selfSignUpEnabled: false). */
  allowSignUp?: boolean;
};

const COPY: Record<Mode, { heading: string; cta: string }> = {
  signIn: { heading: "Welcome back", cta: "Sign in" },
  signUp: { heading: "Create your account", cta: "Create account" },
  confirm: { heading: "Confirm your email", cta: "Confirm email" },
  forgot: { heading: "Reset your password", cta: "Send reset code" },
  resetPassword: { heading: "Choose a new password", cta: "Reset password" },
  newPassword: { heading: "Choose your password", cta: "Save password and sign in" },
};

const PASSWORD_RULE = "At least 10 characters, with upper and lower case letters and a number.";

export function LoginForm({ appName, icon, allowSignUp = true }: Props) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [challengeUser, setChallengeUser] = useState<CognitoUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function go(next: Mode, msg: string | null = null) {
    setError(null);
    setNotice(msg);
    setMode(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signIn") {
        await auth.signIn(email, password);
      } else if (mode === "signUp") {
        await signUp(email, password);
        go("confirm", `We sent a 6-digit code to ${email}.`);
      } else if (mode === "confirm") {
        await confirmSignUp(email, code);
        setCode("");
        go("signIn", "Email confirmed. Sign in to continue.");
      } else if (mode === "forgot") {
        await forgotPassword(email);
        setPassword("");
        go("resetPassword", `If ${email} has an account, we've emailed it a 6-digit code.`);
      } else if (mode === "resetPassword") {
        await confirmPassword(email, code, password);
        setCode("");
        setPassword("");
        go("signIn", "Password reset. Sign in with your new password.");
      } else if (challengeUser) {
        await auth.completeNewPassword(challengeUser, password);
      }
    } catch (err) {
      if (err instanceof NewPasswordRequiredError) {
        setChallengeUser(err.user);
        setPassword("");
        go("newPassword", "You signed in with the temporary password from your invite.");
      } else if ((err as { code?: string }).code === "UserNotConfirmedException") {
        await resendConfirmationCode(email).catch(() => {});
        go("confirm");
        setError(authErrorMessage(err));
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await (mode === "confirm" ? resendConfirmationCode(email) : forgotPassword(email));
      setNotice("We sent a new code. Check your email.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const sub: Record<Mode, string> = {
    signIn: allowSignUp ? `Sign in to ${appName}.` : `${appName} is invite-only. Use the email your invite went to.`,
    signUp: `Create an account to use ${appName}.`,
    confirm: `Enter the code we emailed to ${email}.`,
    forgot: "Enter your account email and we'll send you a reset code.",
    resetPassword: "Enter the code from your email and a new password.",
    newPassword: "Pick your own password to finish signing in.",
  };
  const askEmail = mode === "signIn" || mode === "signUp" || mode === "forgot";
  const askCode = mode === "confirm" || mode === "resetPassword";
  const askPassword = mode !== "confirm" && mode !== "forgot";
  const newPassword = mode === "signUp" || mode === "resetPassword" || mode === "newPassword";

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/10">
          {icon ?? <LockKeyhole className="size-7" />}
        </div>
        <h2 className="font-heading text-2xl tracking-tight">{COPY[mode].heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{sub[mode]}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {askEmail && (
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            icon={<Mail className="size-4" />}
            value={email}
            onChange={setEmail}
            required
          />
        )}
        {askCode && (
          <Field
            id="code"
            label="6-digit code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={setCode}
            required
          />
        )}
        {askPassword && (
          <div className="space-y-1.5">
            <Field
              id="password"
              label={newPassword ? "New password" : "Password"}
              type={showPassword ? "text" : "password"}
              autoComplete={newPassword ? "new-password" : "current-password"}
              icon={<Lock className="size-4" />}
              value={password}
              onChange={setPassword}
              minLength={newPassword ? 10 : undefined}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
            {newPassword && <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>}
          </div>
        )}

        {mode === "signIn" && (
          <div className="-mt-1 text-right">
            <button
              type="button"
              onClick={() => {
                setPassword("");
                go("forgot");
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {COPY[mode].cta}
        </Button>

        {askCode && (
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        )}
      </form>

      {mode === "signIn" && allowSignUp && (
        <FooterLink lead="New here?" label="Create an account" onClick={() => go("signUp")} />
      )}
      {mode === "signUp" && <FooterLink lead="Already have an account?" label="Sign in" onClick={() => go("signIn")} />}
      {mode !== "signIn" && mode !== "signUp" && (
        <FooterLink
          label="Back to sign in"
          onClick={() => {
            setCode("");
            setPassword("");
            setChallengeUser(null);
            go("signIn");
          }}
        />
      )}
    </div>
  );
}

function FooterLink({ lead, label, onClick }: { lead?: string; label: string; onClick: () => void }) {
  return (
    <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
      {lead && <>{lead} </>}
      <button type="button" onClick={onClick} className="font-medium text-primary hover:underline">
        {label}
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  icon,
  trailing,
  ...rest
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email";
  minLength?: number;
}) {
  return (
    <label htmlFor={id} className="relative block">
      <span className="sr-only">{label}</span>
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{icon}</span>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className={cn(
          "h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          icon && "pl-9",
          trailing && "pr-10",
        )}
        {...rest}
      />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </label>
  );
}
