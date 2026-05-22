import http from 'node:http';
import type { JWTClaims } from '@ghs/types';
import { getBearerToken } from '../lib/http';
import { verifyJwt } from '../lib/tokens';

type UserRole = 'admin' | 'player' | 'viewer';

interface AuthenticatedRequest {
  userId: string;
  role: UserRole;
  claims: JWTClaims;
}

interface RBACMiddlewareResult {
  success: boolean;
  auth?: AuthenticatedRequest;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

const VALID_ROLES: UserRole[] = ['admin', 'player', 'viewer'];

export function verifyAndAuthorize(
  req: http.IncomingMessage,
  options: { requiredRoles: UserRole[] },
): RBACMiddlewareResult {
  const token = getBearerToken(req);
  if (!token) {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Missing or invalid authorization token',
    };
  }

  let claims: JWTClaims;
  try {
    claims = verifyJwt(token);
  } catch {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Invalid or expired authorization token',
    };
  }

  if (!claims || claims.tokenType !== 'access' || !claims.sub) {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Invalid access token format',
    };
  }

  const userRole = (claims.role || 'player') as UserRole;
  if (!VALID_ROLES.includes(userRole)) {
    return {
      success: false,
      statusCode: 403,
      errorCode: 'invalid_role',
      errorMessage: 'User has an invalid role',
    };
  }

  if (!options.requiredRoles.includes(userRole)) {
    return {
      success: false,
      statusCode: 403,
      errorCode: 'forbidden',
      errorMessage: `User role '${userRole}' is not authorized for this endpoint`,
    };
  }

  return {
    success: true,
    auth: { userId: String(claims.sub), role: userRole, claims },
  };
}
