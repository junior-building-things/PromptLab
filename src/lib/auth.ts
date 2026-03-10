export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: SessionUser | null;
  error?: string;
};
