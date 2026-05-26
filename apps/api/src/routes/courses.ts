import http from 'node:http';
import { dbPool } from '../lib/db';
import { verifyAndAuthorize } from '../middleware/auth';
import { logAuthAuditEvent } from '../lib/audit';
import { sendJson, sendError, readJsonBody, getClientIp } from '../lib/http';

export interface Course {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  teeConfigurations?: TeeConfiguration[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface TeeConfiguration {
  id: string;
  courseId: string;
  name: string;
  teeColour: string;
  holeCount: number;
  courseRating?: number | null;
  slopeRating?: number | null;
  holes?: Hole[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Hole {
  id: string;
  teeConfigurationId: string;
  holeNumber: number;
  distanceYards?: number | null;
  par: number;
  strokeIndex: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function normalizeCountry(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

export async function handleCreateCourse(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
    if (!authResult.success || !authResult.auth) {
      sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendError(res, 400, 'invalid_json', (error as Error).message);
      return;
    }

    if (typeof payload.name !== 'string' || payload.name.trim() === '') {
      sendError(res, 400, 'validation_error', 'Course name is required');
      return;
    }

    const country = normalizeCountry(payload.country);

    const result = await dbPool.query(
      `INSERT INTO courses (name, address, city, country, phone, email, website) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, address, city, country, phone, email, website, created_at, updated_at`,
      [payload.name.trim(), normalizeOptionalString(payload.address), normalizeOptionalString(payload.city), country, normalizeOptionalString(payload.phone), normalizeOptionalString(payload.email), normalizeOptionalString(payload.website)]
    );

    const course = result.rows[0];
    const clientIp = getClientIp(req);

    await logAuthAuditEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: 'course_created',
      actorUserId: authResult.auth.userId,
      ipAddress: clientIp,
      metadata: { courseId: course.id, courseName: course.name },
    });

    sendJson(res, 201, {
      id: course.id,
      name: course.name,
      address: course.address,
      city: course.city,
      country: course.country,
      phone: course.phone,
      email: course.email,
      website: course.website,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create course';
    sendError(res, 500, 'internal_error', message);
  }
}

export async function handleListCourses(_req: http.IncomingMessage, res: http.ServerResponse, requestUrl: URL): Promise<void> {
  try {
    const page = Math.max(1, parseInt(requestUrl.searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(requestUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const search = normalizeOptionalString(requestUrl.searchParams.get('search'));
    const country = normalizeCountry(requestUrl.searchParams.get('country'));

    let whereClause = 'WHERE deleted_at IS NULL';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (LOWER(name) LIKE LOWER($${params.length}) OR LOWER(city) LIKE LOWER($${params.length}))`;
    }

    if (country) {
      params.push(country);
      whereClause += ` AND country = $${params.length}`;
    }

    const countResult = await dbPool.query(`SELECT COUNT(*)::int AS total FROM courses ${whereClause}`, params);
    const total = countResult.rows[0]?.total || 0;

    params.push(limit, offset);
    const result = await dbPool.query(`SELECT id, name, address, city, country, phone, email, website, created_at, updated_at FROM courses ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);

    const courses = result.rows.map((row) => ({
      id: row.id, name: row.name, address: row.address, city: row.city, country: row.country, phone: row.phone, email: row.email, website: row.website, createdAt: row.created_at, updatedAt: row.updated_at,
    }));

    sendJson(res, 200, { courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list courses';
    sendError(res, 500, 'internal_error', message);
  }
}

export async function handleGetCourse(_req: http.IncomingMessage, res: http.ServerResponse, courseId: string): Promise<void> {
  try {
    const courseResult = await dbPool.query(`SELECT id, name, address, city, country, phone, email, website, created_at, updated_at FROM courses WHERE id = $1 AND deleted_at IS NULL`, [courseId]);

    if (courseResult.rows.length === 0) {
      sendError(res, 404, 'not_found', 'Course not found');
      return;
    }

    const course = courseResult.rows[0];
    const configResult = await dbPool.query(`SELECT id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, created_at, updated_at, deleted_at FROM tee_configurations WHERE course_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`, [courseId]);

    const teeConfigurations = await Promise.all(
      configResult.rows.map(async (config) => {
        const holesResult = await dbPool.query(`SELECT id, tee_configuration_id, hole_number, distance_yards, par, stroke_index, created_at, updated_at FROM holes WHERE tee_configuration_id = $1 ORDER BY hole_number ASC`, [config.id]);
        return { id: config.id, courseId: config.course_id, name: config.name, teeColour: config.tee_colour, holeCount: config.hole_count, courseRating: config.course_rating, slopeRating: config.slope_rating, holes: holesResult.rows.map((hole) => ({ id: hole.id, teeConfigurationId: hole.tee_configuration_id, holeNumber: hole.hole_number, distanceYards: hole.distance_yards, par: hole.par, strokeIndex: hole.stroke_index, createdAt: hole.created_at, updatedAt: hole.updated_at })), createdAt: config.created_at, updatedAt: config.updated_at, deletedAt: config.deleted_at };
      })
    );

    sendJson(res, 200, { id: course.id, name: course.name, address: course.address, city: course.city, country: course.country, phone: course.phone, email: course.email, website: course.website, teeConfigurations, createdAt: course.created_at, updatedAt: course.updated_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get course';
    sendError(res, 500, 'internal_error', message);
  }
}

export async function handleUpdateCourse(req: http.IncomingMessage, res: http.ServerResponse, courseId: string): Promise<void> {
  try {
    const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
    if (!authResult.success || !authResult.auth) {
      sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendError(res, 400, 'invalid_json', (error as Error).message);
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if ('name' in payload) {
      const name = normalizeOptionalString(payload.name);
      if (!name) {
        sendError(res, 400, 'validation_error', 'Course name must be a non-empty string');
        return;
      }
      updates.push(`name = $${paramIdx}`);
      params.push(name);
      paramIdx += 1;
    }

    if ('address' in payload) {
      updates.push(`address = $${paramIdx}`);
      params.push(normalizeOptionalString(payload.address));
      paramIdx += 1;
    }

    if ('city' in payload) {
      updates.push(`city = $${paramIdx}`);
      params.push(normalizeOptionalString(payload.city));
      paramIdx += 1;
    }

    if ('country' in payload) {
      const rawCountry = payload.country;
      const emptyCountry = rawCountry === null || (typeof rawCountry === 'string' && rawCountry.trim() === '');
      if (emptyCountry) {
        updates.push(`country = $${paramIdx}`);
        params.push(null);
        paramIdx += 1;
      } else {
        const country = normalizeCountry(rawCountry);
        if (!country) {
          sendError(res, 400, 'validation_error', 'Country must be a 2-letter ISO code');
          return;
        }
        updates.push(`country = $${paramIdx}`);
        params.push(country);
        paramIdx += 1;
      }
    }

    if ('phone' in payload) {
      updates.push(`phone = $${paramIdx}`);
      params.push(normalizeOptionalString(payload.phone));
      paramIdx += 1;
    }

    if ('email' in payload) {
      updates.push(`email = $${paramIdx}`);
      params.push(normalizeOptionalString(payload.email));
      paramIdx += 1;
    }

    if ('website' in payload) {
      updates.push(`website = $${paramIdx}`);
      params.push(normalizeOptionalString(payload.website));
      paramIdx += 1;
    }

    if (updates.length === 0) {
      sendError(res, 400, 'validation_error', 'No valid fields to update');
      return;
    }

    updates.push('updated_at = NOW()');
    params.push(courseId);

    const result = await dbPool.query(
      `UPDATE courses
       SET ${updates.join(', ')}
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id, name, address, city, country, phone, email, website, created_at, updated_at`,
      params,
    );

    if (result.rows.length === 0) {
      sendError(res, 404, 'not_found', 'Course not found');
      return;
    }

    const course = result.rows[0];
    const clientIp = getClientIp(req);

    await logAuthAuditEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: 'course_updated',
      actorUserId: authResult.auth.userId,
      ipAddress: clientIp,
      metadata: { courseId, updatedFields: updates.filter((field) => field !== 'updated_at = NOW()') },
    });

    sendJson(res, 200, {
      id: course.id,
      name: course.name,
      address: course.address,
      city: course.city,
      country: course.country,
      phone: course.phone,
      email: course.email,
      website: course.website,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update course';
    sendError(res, 500, 'internal_error', message);
  }
}

export async function handleDeleteCourse(req: http.IncomingMessage, res: http.ServerResponse, courseId: string): Promise<void> {
  try {
    const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
    if (!authResult.success || !authResult.auth) {
      sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
      return;
    }

    const courseResult = await dbPool.query(`SELECT id FROM courses WHERE id = $1 AND deleted_at IS NULL`, [courseId]);
    if (courseResult.rows.length === 0) {
      sendError(res, 404, 'not_found', 'Course not found');
      return;
    }

    await dbPool.query(`UPDATE courses SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [courseId]);
    const clientIp = getClientIp(req);

    await logAuthAuditEvent({ requestId: (req.headers['x-request-id'] as string) || '', event: 'course_deleted', actorUserId: authResult.auth.userId, ipAddress: clientIp, metadata: { courseId } });
    sendJson(res, 200, { message: 'Course deleted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete course';
    sendError(res, 500, 'internal_error', message);
  }
}

export async function handleCreateTeeConfiguration(req: http.IncomingMessage, res: http.ServerResponse, courseId: string): Promise<void> {
  try {
    const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
    if (!authResult.success || !authResult.auth) {
      sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendError(res, 400, 'invalid_json', (error as Error).message);
      return;
    }

    if (typeof payload.name !== 'string' || payload.name.trim() === '') {
      sendError(res, 400, 'validation_error', 'Tee configuration name is required');
      return;
    }

    if (typeof payload.teeColour !== 'string' || payload.teeColour.trim() === '') {
      sendError(res, 400, 'validation_error', 'Tee colour is required');
      return;
    }

    if (!Array.isArray(payload.holes) || payload.holes.length === 0) {
      sendError(res, 400, 'validation_error', 'At least one hole is required');
      return;
    }

    const holeCount = payload.holes.length;
    if (holeCount !== 9 && holeCount !== 18) {
      sendError(res, 400, 'validation_error', 'Hole count must be 9 or 18');
      return;
    }

    const holes: Array<{ holeNumber: number; distanceYards: number | null; par: number; strokeIndex: number }> = [];
    for (let idx = 0; idx < payload.holes.length; idx += 1) {
      const hole = payload.holes[idx];
      if (!hole || typeof hole !== 'object') {
        sendError(res, 400, 'validation_error', `Hole ${idx + 1} must be an object`);
        return;
      }

      const h = hole as Record<string, unknown>;

      if (typeof h.holeNumber !== 'number' || h.holeNumber < 1 || h.holeNumber > holeCount) {
        sendError(res, 400, 'validation_error', `Hole ${idx + 1}: holeNumber must be between 1 and ${holeCount}`);
        return;
      }

      if (typeof h.par !== 'number' || h.par < 3 || h.par > 5) {
        sendError(res, 400, 'validation_error', `Hole ${idx + 1}: par must be 3, 4, or 5`);
        return;
      }

      if (typeof h.strokeIndex !== 'number' || h.strokeIndex < 1 || h.strokeIndex > 18) {
        sendError(res, 400, 'validation_error', `Hole ${idx + 1}: strokeIndex must be between 1 and 18`);
        return;
      }

      holes.push({
        holeNumber: h.holeNumber,
        distanceYards: typeof h.distanceYards === 'number' ? h.distanceYards : null,
        par: h.par,
        strokeIndex: h.strokeIndex,
      });
    }

    const holeNumbers = holes.map((h) => h.holeNumber);
    if (new Set(holeNumbers).size !== holeNumbers.length) {
      sendError(res, 400, 'validation_error', 'Hole numbers must be unique');
      return;
    }

    const strokeIndices = holes.map((h) => h.strokeIndex);
    if (new Set(strokeIndices).size !== strokeIndices.length) {
      sendError(res, 400, 'validation_error', 'Stroke indices must be unique');
      return;
    }

    const courseResult = await dbPool.query(`SELECT id FROM courses WHERE id = $1 AND deleted_at IS NULL`, [courseId]);
    if (courseResult.rows.length === 0) {
      sendError(res, 404, 'not_found', 'Course not found');
      return;
    }

    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const configResult = await client.query(`INSERT INTO tee_configurations (course_id, name, tee_colour, hole_count, course_rating, slope_rating) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, created_at, updated_at`, [courseId, payload.name.trim(), payload.teeColour.trim(), holes.length, payload.courseRating || null, payload.slopeRating || null]);

      const config = configResult.rows[0];

      const holesData = await Promise.all(
        holes.map((hole) =>
          client.query(`INSERT INTO holes (tee_configuration_id, hole_number, distance_yards, par, stroke_index) VALUES ($1, $2, $3, $4, $5) RETURNING id, tee_configuration_id, hole_number, distance_yards, par, stroke_index, created_at, updated_at`, [config.id, hole.holeNumber, hole.distanceYards, hole.par, hole.strokeIndex])
        )
      );

      await client.query('COMMIT');

      const holesList = holesData.map((result) => {
        const holeRow = result.rows[0];
        return { id: holeRow.id, teeConfigurationId: holeRow.tee_configuration_id, holeNumber: holeRow.hole_number, distanceYards: holeRow.distance_yards, par: holeRow.par, strokeIndex: holeRow.stroke_index, createdAt: holeRow.created_at, updatedAt: holeRow.updated_at };
      });

      const clientIp = getClientIp(req);

      await logAuthAuditEvent({
        requestId: (req.headers['x-request-id'] as string) || '',
        event: 'tee_configuration_created',
        actorUserId: authResult.auth.userId,
        ipAddress: clientIp,
        metadata: { courseId, configId: config.id },
      });

      sendJson(res, 201, {
        id: config.id,
        courseId: config.course_id,
        name: config.name,
        teeColour: config.tee_colour,
        holeCount: config.hole_count,
        courseRating: config.course_rating,
        slopeRating: config.slope_rating,
        holes: holesList,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create tee configuration';
    sendError(res, 400, 'bad_request', message);
  }
}

export async function handleUpdateTeeConfiguration(req: http.IncomingMessage, res: http.ServerResponse, configId: string): Promise<void> {
  try {
    const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
    if (!authResult.success || !authResult.auth) {
      sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendError(res, 400, 'invalid_json', (error as Error).message);
      return;
    }

    if ('holes' in payload) {
      if (!Array.isArray(payload.holes)) {
        sendError(res, 400, 'validation_error', 'Holes must be an array');
        return;
      }

      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        // Allow temporary uniqueness collisions while swapping hole/stroke indexes.
        await client.query('SET CONSTRAINTS ALL DEFERRED');

        const configResult = await client.query(`SELECT id FROM tee_configurations WHERE id = $1 AND deleted_at IS NULL`, [configId]);
        if (configResult.rows.length === 0) {
          sendError(res, 404, 'not_found', 'Tee configuration not found');
          return;
        }

        const updatedHoles = await Promise.all(
          (payload.holes as Array<{ id: string; holeNumber?: number; distanceYards?: number | null; par?: number; strokeIndex?: number }>).map(async (hole) => {
            const updates: string[] = ['updated_at = NOW()'];
            const params: unknown[] = [];
            let paramIdx = 1;

            if (typeof hole.holeNumber === 'number') {
              updates.unshift(`hole_number = $${paramIdx}`);
              params.push(hole.holeNumber);
              paramIdx += 1;
            }

            if (typeof hole.distanceYards === 'number' || hole.distanceYards === null) {
              updates.unshift(`distance_yards = $${paramIdx}`);
              params.push(hole.distanceYards);
              paramIdx += 1;
            }

            if (typeof hole.par === 'number') {
              updates.unshift(`par = $${paramIdx}`);
              params.push(hole.par);
              paramIdx += 1;
            }

            if (typeof hole.strokeIndex === 'number') {
              updates.unshift(`stroke_index = $${paramIdx}`);
              params.push(hole.strokeIndex);
              paramIdx += 1;
            }

            params.push(hole.id);

            const result = await client.query(`UPDATE holes SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
            return result.rows[0];
          })
        );

        await client.query('COMMIT');
        sendJson(res, 200, { holes: updatedHoles });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (typeof payload.name === 'string' && payload.name.trim()) {
        updates.push(`name = $${paramIdx}`);
        params.push(payload.name.trim());
        paramIdx += 1;
      }

      if (typeof payload.teeColour === 'string' && payload.teeColour.trim()) {
        updates.push(`tee_colour = $${paramIdx}`);
        params.push(payload.teeColour.trim());
        paramIdx += 1;
      }

      if (typeof payload.courseRating === 'number' || payload.courseRating === null) {
        updates.push(`course_rating = $${paramIdx}`);
        params.push(payload.courseRating);
        paramIdx += 1;
      }

      if (typeof payload.slopeRating === 'number' || payload.slopeRating === null) {
        updates.push(`slope_rating = $${paramIdx}`);
        params.push(payload.slopeRating);
        paramIdx += 1;
      }

      if (updates.length === 0) {
        sendError(res, 400, 'validation_error', 'No valid fields to update');
        return;
      }

      updates.push(`updated_at = NOW()`);
      params.push(configId);

      const result = await dbPool.query(`UPDATE tee_configurations SET ${updates.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`, params);
      if (result.rows.length === 0) {
        sendError(res, 404, 'not_found', 'Tee configuration not found');
        return;
      }

      const config = result.rows[0];
      const clientIp = getClientIp(req);

      await logAuthAuditEvent({
        requestId: (req.headers['x-request-id'] as string) || '',
        event: 'tee_configuration_updated',
        actorUserId: authResult.auth.userId,
        ipAddress: clientIp,
        metadata: { configId },
      });

      sendJson(res, 200, {
        id: config.id,
        courseId: config.course_id,
        name: config.name,
        teeColour: config.tee_colour,
        holeCount: config.hole_count,
        courseRating: config.course_rating,
        slopeRating: config.slope_rating,
        updatedAt: config.updated_at,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update tee configuration';
    sendError(res, 400, 'bad_request', message);
  }
}
