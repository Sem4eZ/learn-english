export interface AuthUser {
  id: string;
  username: string;
  xp: number;
  streak: number;
  level: number;
  isGuest?: boolean;
}
