export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  openId?: string;
  unionId?: string;
  userId?: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: SessionUser | null;
  error?: string;
};
