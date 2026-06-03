import http from 'node:http';
import type { JWTClaims } from '@ghs/types';
import { getBearerToken, getClientIp } from '../lib/http';
import { verifyJwt } from '../lib/tokens';
import { logAuthAuditEvent } from '../lib/audit';

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

function getRequestId(req: http.IncomingMessage): string {
  const headerValue = req.headers['x-request-id'];
  return typeof headerValue === 'string' ? headerValue : '';
}

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

/**
 * Admin-only middleware with access logging
 * Logs both successful admin access and failed attempts to access admin endpoints
 * Async function - should be awaited in route handlers
 */
export async function verifyAdminAndLog(
  req: http.IncomingMessage,
): Promise<RBACMiddlewareResult> {
  const requestId = getRequestId(req);
  const clientIp = getClientIp(req);

  // Perform JWT + role verification
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });

  if (authResult.success && authResult.auth) {
    // Log successful admin access
    await logAuthAuditEvent({
      requestId,
      event: 'admin_access_allowed',
      ipAddress: clientIp,
      metadata: {
        method: req.method || 'GET',
        path: req.url || '/',
        userId: authResult.auth.userId,
        role: authResult.auth.role,
      },
    });
  } else {
    // Log failed admin access attempts
    const token = getBearerToken(req);
    let userId: string | undefined;
    let role: string | undefined;

    if (token) {
      try {
        const claims = verifyJwt(token);
        userId = String(claims.sub || '');
        role = String(claims.role || 'unknown');
      } catch {
        // Token invalid, userId stays undefined
      }
    }

    await logAuthAuditEvent({
      requestId,
      event: 'admin_access_denied',
      ipAddress: clientIp,
      metadata: {
        method: req.method || 'GET',
        path: req.url || '/',
        attemptedUserId: userId,
        errorCode: authResult.errorCode,
        attemptedRole: role,
        reason: authResult.errorMessage,
      },
    });
  }

  return authResult;
}
