export interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  permissions: string[];
}
