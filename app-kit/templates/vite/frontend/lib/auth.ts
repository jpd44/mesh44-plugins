import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  type ISignUpResult,
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

export function signUp(email: string, password: string): Promise<ISignUpResult> {
  return new Promise((resolve, reject) => {
    userPool().signUp(
      email,
      password,
      [new CognitoUserAttribute({ Name: "email", Value: email })],
      [],
      (err, result) => (err || !result ? reject(err) : resolve(result)),
    );
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: userPool() }).confirmRegistration(
      code,
      true,
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: userPool() }).resendConfirmationCode(
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

// Sends a reset code to the user's email. With preventUserExistenceErrors on the pool
// client, unknown emails resolve too, so the UI shouldn't claim the account exists.
export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: userPool() }).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
      inputVerificationCode: () => resolve(),
    });
  });
}

export function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: userPool() }).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      {
        onSuccess: (session) => resolve(session),
        onFailure: (err) => reject(err),
      },
    );
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
