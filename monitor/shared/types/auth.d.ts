// The session user, as the OIDC login stores it (see server/utils/oidc.ts).
declare module "#auth-utils" {
  interface User {
    sub: string;
    name: string;
    email: string;
  }

  interface UserSession {
    loggedInAt: number;
  }
}

export {};
