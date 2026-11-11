import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

// Created on first use: `new CognitoUserPool` throws when the IDs are empty,
// which they are until the first `cdk deploy` fills in `.env.local`.
let pool: CognitoUserPool | null = null;
function userPool(): CognitoUserPool {
  pool ??= new CognitoUserPool({
    UserPoolId: import.meta.env.VITE_USER_POOL_ID,
    ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  });
  return pool;
}

const cognitoUser = (email: string) => new CognitoUser({ Username: email, Pool: userPool() });

// Invited users sign in with a temporary password; Cognito then requires a new one.
export class NewPasswordRequiredError extends Error {
  user: CognitoUser;

  constructor(user: CognitoUser) {
    super("Choose a new password to finish signing in.");
    this.name = "NewPasswordRequiredError";
    this.user = user;
  }
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = cognitoUser(email);
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new NewPasswordRequiredError(user)),
    });
  });
}

export function completeNewPassword(user: CognitoUser, newPassword: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    // Attributes stay as they are; only the password changes.
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    userPool().signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email })], [], (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cognitoUser(email).confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cognitoUser(email).resendConfirmationCode((err) => (err ? reject(err) : resolve()));
  });
}

// Sends a reset code to the user's email. With preventUserExistenceErrors on the pool
// client, unknown emails resolve too, so the UI shouldn't claim the account exists.
export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cognitoUser(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
      inputVerificationCode: () => resolve(),
    });
  });
}

export function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cognitoUser(email).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const user = userPool().getCurrentUser();
  if (!user) return Promise.reject(new Error("You're signed out. Sign in again to change your password."));
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        reject(new Error("Your session has expired. Sign in again to change your password."));
        return;
      }
      user.changePassword(oldPassword, newPassword, (err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

export function signOut(): void {
  userPool().getCurrentUser()?.signOut();
}

export function getCurrentUser(): CognitoUser | null {
  return userPool().getCurrentUser();
}

export function getSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve, reject) => {
    const user = userPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) return reject(err);
      resolve(session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session?.isValid() ? session.getIdToken().getJwtToken() : null;
}

/** Cognito's error codes, said plainly. Unknown errors fall back to Cognito's own message. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string; name?: string } | null)?.code ?? (err as Error | null)?.name;
  switch (code) {
    case "NotAuthorizedException":
      return "Incorrect email or password.";
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "CodeMismatchException":
      return "That code doesn't match. Check the latest email and try again.";
    case "ExpiredCodeException":
      return "That code has expired. Send a new one.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "UsernameExistsException":
      return "An account with this email already exists. Sign in instead.";
    case "InvalidPasswordException":
      return "Use at least 10 characters, with upper and lower case letters and a number.";
    case "UserNotConfirmedException":
      return "Confirm your email first. We've sent you a new code.";
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
}
