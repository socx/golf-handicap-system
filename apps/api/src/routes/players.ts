import http from 'node:http';
import { sendJson, sendError, readJsonBody, getClientIp } from '../lib/http';
import { dbPool } from '../lib/db';
import { verifyAndAuthorize } from '../middleware/auth';
import { logAuthAuditEvent } from '../lib/audit';
import { createImportJob } from '../lib/importJobs';
import { sendEmail } from '../lib/email';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  dob: string | null;
  gender: Gender | null;
  club: string | null;
  email: string | null;
  country: string;
  handicap_index: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PlayerDetailRow extends Player {
  current_handicap_index: number | null;
  last_handicap_update_date: string | null;
  round_count: number;
  last_round_date: string | null;
}

interface ValidationIssue {
  field: string;
  message: string;
}

interface PlayerImportRowResult {
  rowNumber: number;
  values: {
    first_name: string;
    last_name: string;
    dob: string | null;
    gender: Gender | null;
    club: string | null;
    country: string;
    email: string | null;
  };
  issues: ValidationIssue[];
}

interface PlayerFilters {
  search: string;
  club: string;
  country: string;
  includeDeleted: boolean;
}

const VALID_GENDERS: Gender[] = ['male', 'female', 'other', 'prefer_not_to_say'];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeCountry(value: unknown): string {
  const raw = normalizeRequiredString(value).toUpperCase();
  return raw;
}

function parseDob(value: unknown): string | null {
  const raw = normalizeOptionalString(value);
  if (!raw) return null;
  return raw;
}

function parseGender(value: unknown): Gender | null {
  const raw = normalizeOptionalString(value)?.toLowerCase() || null;
  if (!raw) return null;
  return VALID_GENDERS.includes(raw as Gender) ? (raw as Gender) : null;
}

function parseHandicap(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function validateCreatePayload(payload: Record<string, unknown>): {
  errors: ValidationIssue[];
  value: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    dob: string | null;
    gender: Gender | null;
    club: string | null;
    email: string | null;
    country: string;
    handicapIndex: number | null;
    userId: string | null;
  };
} {
  const errors: ValidationIssue[] = [];

  const firstName = normalizeRequiredString(payload.first_name);
  const lastName = normalizeRequiredString(payload.last_name);
  const middleName = normalizeOptionalString(payload.middle_name);
  const dob = parseDob(payload.dob);
  const gender = parseGender(payload.gender);
  const club = normalizeOptionalString(payload.club);
  const email = normalizeOptionalString(payload.email)?.toLowerCase() || null;
  const country = normalizeCountry(payload.country);
  const handicapIndex = parseHandicap(payload.handicap_index);
  const userId = normalizeOptionalString(payload.user_id);

  if (!firstName) errors.push({ field: 'first_name', message: 'First name is required' });
  if (!lastName) errors.push({ field: 'last_name', message: 'Last name is required' });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Email must be a valid address' });
  }

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    errors.push({ field: 'country', message: 'Country must be a 2-letter ISO code' });
  }

  if (payload.gender !== undefined && payload.gender !== null && !gender) {
    errors.push({ field: 'gender', message: `Gender must be one of: ${VALID_GENDERS.join(', ')}` });
  }

  if (dob) {
    const parsed = new Date(dob);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
      errors.push({ field: 'dob', message: 'Date of birth must be YYYY-MM-DD' });
    } else if (parsed > new Date()) {
      errors.push({ field: 'dob', message: 'Date of birth cannot be in the future' });
    }
  }

  if (Number.isNaN(handicapIndex)) {
    errors.push({ field: 'handicap_index', message: 'Handicap index must be numeric' });
  }

  if (userId && !isUuid(userId)) {
    errors.push({ field: 'user_id', message: 'User id must be a valid UUID' });
  }

  return {
    errors,
    value: {
      firstName,
      lastName,
      middleName,
      dob,
      gender,
      club,
      email,
      country,
      handicapIndex: Number.isNaN(handicapIndex) ? null : handicapIndex,
      userId,
    },
  };
}

function validateUpdatePayload(payload: Record<string, unknown>): {
  errors: ValidationIssue[];
  update: Record<string, unknown>;
} {
  const errors: ValidationIssue[] = [];
  const update: Record<string, unknown> = {};

  if (Object.keys(payload).length === 0) {
    errors.push({ field: 'body', message: 'At least one field must be provided' });
    return { errors, update };
  }

  if ('first_name' in payload) {
    const firstName = normalizeRequiredString(payload.first_name);
    if (!firstName) errors.push({ field: 'first_name', message: 'First name cannot be empty' });
    else update.first_name = firstName;
  }

  if ('last_name' in payload) {
    const lastName = normalizeRequiredString(payload.last_name);
    if (!lastName) errors.push({ field: 'last_name', message: 'Last name cannot be empty' });
    else update.last_name = lastName;
  }

  if ('middle_name' in payload) {
    update.middle_name = normalizeOptionalString(payload.middle_name);
  }

  if ('dob' in payload) {
    const dob = parseDob(payload.dob);
    if (dob) {
      const parsed = new Date(dob);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
        errors.push({ field: 'dob', message: 'Date of birth must be YYYY-MM-DD' });
      } else if (parsed > new Date()) {
        errors.push({ field: 'dob', message: 'Date of birth cannot be in the future' });
      }
    }
    update.dob = dob;
  }

  if ('gender' in payload) {
    if (payload.gender === null || payload.gender === '') {
      update.gender = null;
    } else {
      const gender = parseGender(payload.gender);
      if (!gender) {
        errors.push({ field: 'gender', message: `Gender must be one of: ${VALID_GENDERS.join(', ')}` });
      } else {
        update.gender = gender;
      }
    }
  }

  if ('club' in payload) {
    update.club = normalizeOptionalString(payload.club);
  }

  if ('email' in payload) {
    const email = normalizeOptionalString(payload.email)?.toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'Email must be a valid address' });
    } else {
      update.email = email;
    }
  }

  if ('country' in payload) {
    const country = normalizeCountry(payload.country);
    if (!country || !/^[A-Z]{2}$/.test(country)) {
      errors.push({ field: 'country', message: 'Country must be a 2-letter ISO code' });
    } else {
      update.country = country;
    }
  }

  if ('handicap_index' in payload) {
    const handicapIndex = parseHandicap(payload.handicap_index);
    if (Number.isNaN(handicapIndex)) {
      errors.push({ field: 'handicap_index', message: 'Handicap index must be numeric' });
    } else {
      update.handicap_index = handicapIndex;
    }
  }

  if ('user_id' in payload) {
    const userId = normalizeOptionalString(payload.user_id);
    if (userId && !isUuid(userId)) {
      errors.push({ field: 'user_id', message: 'User id must be a valid UUID' });
    } else {
      update.user_id = userId;
    }
  }

  return { errors, update };
}

async function fetchPlayerById(playerId: string): Promise<Player | null> {
  const result = await dbPool.query(
    `SELECT id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at
     FROM players
     WHERE id = $1
     LIMIT 1`,
    [playerId],
  );
  return (result.rows[0] as Player | undefined) || null;
}

async function ensureUserExists(userId: string): Promise<boolean> {
  const result = await dbPool.query('SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [userId]);
  return Number(result.rowCount || 0) > 0;
}

async function getLinkedPlayerIdForUser(userId: string): Promise<string | null> {
  const result = await dbPool.query(
    'SELECT id FROM players WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1',
    [userId],
  );

  if (Number(result.rowCount || 0) === 0) {
    return null;
  }

  return String(result.rows[0].id);
}

function parsePagination(requestUrl: URL): { page: number; limit: number; offset: number } {
  const pageRaw = Number(requestUrl.searchParams.get('page') || '1');
  const limitRaw = Number(requestUrl.searchParams.get('limit') || '20');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseBooleanQueryParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parsePlayerFilters(requestUrl: URL): PlayerFilters {
  const search = (requestUrl.searchParams.get('search') || '').trim();
  const club = (requestUrl.searchParams.get('club') || '').trim();
  const country = (requestUrl.searchParams.get('country') || '').trim().toUpperCase();
  const includeDeleted = parseBooleanQueryParam(requestUrl.searchParams.get('include_deleted'))
    || parseBooleanQueryParam(requestUrl.searchParams.get('includeDeleted'));

  return { search, club, country, includeDeleted };
}

function buildPlayerWhereClause(filters: PlayerFilters): { whereClause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!filters.includeDeleted) {
    clauses.push('deleted_at IS NULL');
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(`(
      LOWER(first_name) LIKE $${idx}
      OR LOWER(last_name) LIKE $${idx}
      OR LOWER(COALESCE(email, '')) LIKE $${idx}
    )`);
  }

  if (filters.club) {
    params.push(filters.club);
    clauses.push(`club = $${params.length}`);
  }

  if (filters.country) {
    params.push(filters.country);
    clauses.push(`country = $${params.length}`);
  }

  return {
    whereClause: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
    params,
  };
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseImportedName(name: string): { firstName: string; lastName: string } {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function normalizeImportHeader(header: string): string {
  return header.trim().toLowerCase();
}

function parsePlayerImportRows(csvText: string): { headers: string[]; rows: PlayerImportRowResult[] } {
  const parsedRows = parseCsvText(csvText);
  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parsedRows[0].map(normalizeImportHeader);
  const results: PlayerImportRowResult[] = [];

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const row = parsedRows[rowIndex];
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) as Record<string, string>;
    const issues: ValidationIssue[] = [];

    const fullName = record.name?.trim() || '';
    const parsedName = fullName ? parseImportedName(fullName) : { firstName: '', lastName: '' };
    const firstName = normalizeRequiredString(record.first_name || parsedName.firstName);
    const lastName = normalizeRequiredString(record.last_name || parsedName.lastName);
    const dob = parseDob(record.dob);
    const gender = parseGender(record.gender);
    const club = normalizeOptionalString(record.club);
    const country = normalizeCountry(record.country || 'GB');
    const email = normalizeOptionalString(record.email)?.toLowerCase() || null;

    if (!firstName) {
      issues.push({ field: 'first_name', message: 'First name is required' });
    }

    if (!lastName) {
      issues.push({ field: 'last_name', message: 'Last name is required' });
    }

    if (dob) {
      const parsed = new Date(dob);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
        issues.push({ field: 'dob', message: 'DOB must be YYYY-MM-DD' });
      }
    }

    if (record.gender && !gender) {
      issues.push({ field: 'gender', message: `Gender must be one of: ${VALID_GENDERS.join(', ')}` });
    }

    if (!country || !/^[A-Z]{2}$/.test(country)) {
      issues.push({ field: 'country', message: 'Country must be a 2-letter ISO code' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ field: 'email', message: 'Email must be a valid address' });
    }

    results.push({
      rowNumber: rowIndex + 1,
      values: {
        first_name: firstName,
        last_name: lastName,
        dob,
        gender,
        club,
        country,
        email,
      },
      issues,
    });
  }

  return { headers, rows: results };
}

function buildPlayersCsv(rows: Player[]): string {
  const columns = [
    'id',
    'first_name',
    'last_name',
    'middle_name',
    'dob',
    'gender',
    'club',
    'email',
    'country',
    'handicap_index',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ];

  const lines = [columns.join(',')];
  for (const row of rows) {
    const values = columns.map((column) => escapeCsvCell(row[column as keyof Player]));
    lines.push(values.join(','));
  }

  return `${lines.join('\n')}\n`;
}

export async function handleGetPlayer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'Player id must be a valid UUID');
    return;
  }

  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    if (linkedPlayerId !== playerId) {
      sendError(res, 403, 'forbidden', 'Players can only access their own profile');
      return;
    }
  }

  try {
    const result = await dbPool.query<PlayerDetailRow>(
      `SELECT p.id, p.first_name, p.last_name, p.middle_name, p.dob, p.gender, p.club, p.email, p.country,
              p.handicap_index, p.user_id, p.created_at, p.updated_at, p.deleted_at,
              COALESCE(hr.handicap_index, p.handicap_index) AS current_handicap_index,
              hr.calculation_date AS last_handicap_update_date,
              COALESCE(rs.round_count, 0)::int AS round_count,
              rs.last_round_date
       FROM players p
       LEFT JOIN LATERAL (
         SELECT handicap_index, calculation_date
         FROM handicap_records
         WHERE player_id = p.id
         ORDER BY calculation_date DESC, created_at DESC
         LIMIT 1
       ) hr ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS round_count, MAX(played_at) AS last_round_date
         FROM rounds
         WHERE player_id = p.id AND deleted_at IS NULL
       ) rs ON TRUE
       WHERE p.id = $1
       LIMIT 1`,
      [playerId],
    );

    const detail = result.rows[0] || null;
    if (!detail || detail.deleted_at) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    const player: Player = {
      id: detail.id,
      first_name: detail.first_name,
      last_name: detail.last_name,
      middle_name: detail.middle_name,
      dob: detail.dob,
      gender: detail.gender,
      club: detail.club,
      email: detail.email,
      country: detail.country,
      handicap_index: detail.handicap_index,
      user_id: detail.user_id,
      created_at: detail.created_at,
      updated_at: detail.updated_at,
      deleted_at: detail.deleted_at,
    };

    sendJson(res, 200, {
      player,
      handicap_summary: {
        current_handicap_index: detail.current_handicap_index,
        last_handicap_update_date: detail.last_handicap_update_date,
      },
      round_stats: {
        round_count: detail.round_count,
        last_round_date: detail.last_round_date,
      },
    });
  } catch (error) {
    console.error('[players.get] unexpected error:', error);
    sendError(res, 500, 'player_fetch_failed', 'Unable to fetch player at this time');
  }
}

export async function handleCreatePlayer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
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

  const validation = validateCreatePayload(payload);
  if (validation.errors.length > 0) {
    sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
    return;
  }

  try {
    if (validation.value.userId) {
      const userExists = await ensureUserExists(validation.value.userId);
      if (!userExists) {
        sendError(res, 404, 'not_found', 'User not found');
        return;
      }
    }

    const result = await dbPool.query(
      `INSERT INTO players
       (first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at`,
      [
        validation.value.firstName,
        validation.value.lastName,
        validation.value.middleName,
        validation.value.dob,
        validation.value.gender,
        validation.value.club,
        validation.value.email,
        validation.value.country,
        validation.value.handicapIndex,
        validation.value.userId,
      ],
    );

    sendJson(res, 201, { player: result.rows[0] });
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.code === '23505') {
      sendError(res, 409, 'duplicate_record', 'A player with that email or linked user already exists');
      return;
    }
    console.error('[players.create] unexpected error:', error);
    sendError(res, 500, 'player_create_failed', 'Unable to create player at this time');
  }
}

export async function handleUpdatePlayer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'Player id must be a valid UUID');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const validation = validateUpdatePayload(payload);
  if (validation.errors.length > 0) {
    sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
    return;
  }

  try {
    const existing = await fetchPlayerById(playerId);
    if (!existing) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }
    if (existing.deleted_at) {
      sendError(res, 409, 'player_deleted', 'Cannot update a soft-deleted player');
      return;
    }

    if (typeof validation.update.user_id === 'string') {
      const userExists = await ensureUserExists(validation.update.user_id);
      if (!userExists) {
        sendError(res, 404, 'not_found', 'User not found');
        return;
      }
    }

    const fields = Object.keys(validation.update);
    const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
    const values = fields.map((field) => validation.update[field]);

    const result = await dbPool.query(
      `UPDATE players
       SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at`,
      [playerId, ...values],
    );

    const player = (result.rows[0] as Player | undefined) || null;
    if (!player) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    sendJson(res, 200, { player });
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.code === '23505') {
      sendError(res, 409, 'duplicate_record', 'A player with that email or linked user already exists');
      return;
    }
    console.error('[players.update] unexpected error:', error);
    sendError(res, 500, 'player_update_failed', 'Unable to update player at this time');
  }
}

export async function handleListPlayers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const filters = parsePlayerFilters(requestUrl);
  const { page, limit, offset } = parsePagination(requestUrl);
  const { whereClause: baseWhereClause, params } = buildPlayerWhereClause(filters);

  const clauses = [baseWhereClause];
  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }
    params.push(linkedPlayerId);
    clauses.push(`id = $${params.length}`);
  }

  const whereClause = clauses.join(' AND ');

  try {
    const countResult = await dbPool.query(`SELECT COUNT(*)::int AS total FROM players WHERE ${whereClause}`, params);
    const total = Number((countResult.rows[0] as { total: number }).total || 0);

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const result = await dbPool.query(
      `SELECT id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at
       FROM players
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params,
    );

    sendJson(res, 200, {
      players: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        search: filters.search,
        club: filters.club,
        country: filters.country,
      },
    });
  } catch (error) {
    console.error('[players.list] unexpected error:', error);
    sendError(res, 500, 'player_list_failed', 'Unable to retrieve players at this time');
  }
}

export async function handleExportPlayers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const format = (requestUrl.searchParams.get('format') || '').trim().toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    sendError(res, 400, 'validation_error', "Query parameter 'format' must be either 'csv' or 'json'");
    return;
  }

  const filters = parsePlayerFilters(requestUrl);
  const { whereClause, params } = buildPlayerWhereClause(filters);

  try {
    const result = await dbPool.query(
      `SELECT id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at
       FROM players
       WHERE ${whereClause}
       ORDER BY created_at DESC`,
      params,
    );

    const players = result.rows as Player[];
    if (format === 'json') {
      sendJson(res, 200, {
        format,
        count: players.length,
        filters: {
          search: filters.search,
          club: filters.club,
          country: filters.country,
        },
        includeDeleted: filters.includeDeleted,
        players,
      });
      return;
    }

    const csv = buildPlayersCsv(players);
    const fileSuffix = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="players-export-${fileSuffix}.csv"`,
      'cache-control': 'no-store',
    });
    res.end(csv);
  } catch (error) {
    console.error('[players.export] unexpected error:', error);
    sendError(res, 500, 'player_export_failed', 'Unable to export players at this time');
  }
}

export async function handleImportPlayers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
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

  const csvText = typeof payload.csvText === 'string' ? payload.csvText.trim() : '';
  const dryRun = payload.dryRun !== false;

  if (!csvText) {
    sendError(res, 400, 'validation_error', 'csvText is required');
    return;
  }

  const { headers, rows } = parsePlayerImportRows(csvText);
  if (headers.length === 0 || rows.length === 0) {
    sendError(res, 400, 'validation_error', 'CSV must include a header row and at least one data row');
    return;
  }

  const totalIssues = rows.reduce((sum, row) => sum + row.issues.length, 0);
  if (dryRun) {
    sendJson(res, 200, {
      dryRun: true,
      summary: {
        rowCount: rows.length,
        validRows: rows.filter((row) => row.issues.length === 0).length,
        invalidRows: rows.filter((row) => row.issues.length > 0).length,
        totalIssues,
      },
      rows,
    });
    return;
  }

  if (totalIssues > 0) {
    sendJson(res, 400, {
      error: {
        code: 'validation_error',
        message: 'Import contains validation errors',
      },
      dryRun: false,
      summary: {
        rowCount: rows.length,
        validRows: rows.filter((row) => row.issues.length === 0).length,
        invalidRows: rows.filter((row) => row.issues.length > 0).length,
        totalIssues,
      },
      rows,
    });
    return;
  }

  const LARGE_IMPORT_THRESHOLD = 100;
  if (rows.length > LARGE_IMPORT_THRESHOLD) {
    const userResult = await dbPool.query<{ email: string }>(
      `SELECT email::text AS email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [authResult.auth.userId],
    );
    const adminEmail = String((userResult.rows[0] as { email: string } | undefined)?.email ?? '');
    const job = createImportJob({
      type: 'players',
      totalRows: rows.length,
      adminUserId: authResult.auth.userId,
      adminEmail,
    });

    sendJson(res, 202, {
      queued: true,
      jobId: job.jobId,
      rowCount: rows.length,
      adminEmail,
      message: `Large import queued (${rows.length} rows). An email will be sent to ${adminEmail} when complete.`,
    });

    setImmediate(async () => {
      job.status = 'in_progress';
      const bgClient = await dbPool.connect();
      try {
        await bgClient.query('BEGIN');
        for (const row of rows) {
          try {
            await bgClient.query(
              `INSERT INTO players (first_name, last_name, dob, gender, club, email, country)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                row.values.first_name,
                row.values.last_name,
                row.values.dob,
                row.values.gender,
                row.values.club,
                row.values.email,
                row.values.country,
              ],
            );
            job.processedRows += 1;
            job.importedRows += 1;
          } catch (rowErr) {
            job.processedRows += 1;
            job.failedRows += 1;
            job.errors.push(`Row ${job.processedRows}: ${(rowErr as Error).message}`);
          }
        }
        await bgClient.query('COMMIT');
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        await sendEmail(
          adminEmail,
          `Player import complete – ${job.importedRows} of ${job.totalRows} rows imported`,
          {
            text: `Your player CSV import has completed.\n\nImported: ${job.importedRows} of ${job.totalRows} rows\nFailed: ${job.failedRows} rows${job.errors.length > 0 ? '\n\nErrors (first 10):\n' + job.errors.slice(0, 10).join('\n') : ''}`,
            html: `<p>Your player CSV import has completed.</p><ul><li><strong>Imported:</strong> ${job.importedRows} of ${job.totalRows} rows</li><li><strong>Failed:</strong> ${job.failedRows} rows</li></ul>${job.errors.length > 0 ? '<p><strong>Errors (first 10):</strong></p><ul>' + job.errors.slice(0, 10).map((e) => `<li>${e}</li>`).join('') + '</ul>' : ''}`,
          },
        ).catch((emailErr: Error) => {
          console.error('[players.import.bg] completion email failed:', emailErr.message);
        });
      } catch (bgErr) {
        await bgClient.query('ROLLBACK').catch(() => {});
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.errors.push((bgErr as Error).message);
        await sendEmail(
          adminEmail,
          'Player import failed',
          {
            text: `Your player CSV import failed.\n\nError: ${(bgErr as Error).message}`,
            html: `<p>Your player CSV import failed.</p><p><strong>Error:</strong> ${(bgErr as Error).message}</p>`,
          },
        ).catch(() => {});
        console.error('[players.import.bg] background job failed:', bgErr);
      } finally {
        bgClient.release();
      }
    });
    return;
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const insertedPlayers: Player[] = [];
    for (const row of rows) {
      const insertResult = await client.query(
        `INSERT INTO players (first_name, last_name, dob, gender, club, email, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at`,
        [
          row.values.first_name,
          row.values.last_name,
          row.values.dob,
          row.values.gender,
          row.values.club,
          row.values.email,
          row.values.country,
        ],
      );
      insertedPlayers.push(insertResult.rows[0] as Player);
    }

    await client.query('COMMIT');
    sendJson(res, 201, {
      dryRun: false,
      summary: {
        rowCount: rows.length,
        importedRows: insertedPlayers.length,
      },
      players: insertedPlayers,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const err = error as Record<string, unknown>;
    if (err.code === '23505') {
      sendError(res, 409, 'duplicate_record', 'One or more players conflict with existing active records');
      return;
    }
    console.error('[players.import] unexpected error:', error);
    sendError(res, 500, 'player_import_failed', 'Unable to import players at this time');
  } finally {
    client.release();
  }
}

export async function handleLinkPlayerUser(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
  playerId: string,
): Promise<void> {
  const clientIp = getClientIp(req);
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'Player id must be a valid UUID');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const userId = normalizeOptionalString(payload.user_id);
  if (payload.user_id !== null && payload.user_id !== undefined && !userId) {
    sendError(res, 400, 'validation_error', 'user_id must be a valid UUID or null');
    return;
  }
  if (userId && !isUuid(userId)) {
    sendError(res, 400, 'validation_error', 'user_id must be a valid UUID');
    return;
  }

  try {
    const existing = await fetchPlayerById(playerId);
    if (!existing || existing.deleted_at) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    if (userId) {
      const userExists = await ensureUserExists(userId);
      if (!userExists) {
        sendError(res, 404, 'not_found', 'User not found');
        return;
      }
    }

    const result = await dbPool.query(
      `UPDATE players
       SET user_id = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at`,
      [playerId, userId],
    );

    const player = (result.rows[0] as Player | undefined) || null;
    if (!player) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    await logAuthAuditEvent({
      requestId,
      event: userId ? 'player_user_linked' : 'player_user_unlinked',
      userId,
      actorUserId: authResult.auth.userId,
      ipAddress: clientIp,
      metadata: {
        playerId,
        previousUserId: existing.user_id,
        linkedUserId: userId,
      },
    });

    sendJson(res, 200, {
      player,
      message: userId ? 'Player linked to user account' : 'Player unlinked from user account',
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.code === '23505') {
      sendError(res, 409, 'duplicate_record', 'User is already linked to another player');
      return;
    }
    console.error('[players.link] unexpected error:', error);
    sendError(res, 500, 'player_link_failed', 'Unable to link player at this time');
  }
}

export async function handleDeletePlayer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
  playerId: string,
): Promise<void> {
  const clientIp = getClientIp(req);
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'Player id must be a valid UUID');
    return;
  }

  try {
    const result = await dbPool.query(
      `UPDATE players
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id, created_at, updated_at, deleted_at`,
      [playerId],
    );

    const player = (result.rows[0] as Player | undefined) || null;
    if (!player) {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    await logAuthAuditEvent({
      requestId,
      event: 'player_deleted',
      userId: player.user_id,
      actorUserId: authResult.auth.userId,
      ipAddress: clientIp,
      metadata: {
        playerId,
        softDeleted: true,
      },
    });

    sendJson(res, 200, { player, message: 'Player soft-deleted successfully' });
  } catch (error) {
    console.error('[players.delete] unexpected error:', error);
    sendError(res, 500, 'player_delete_failed', 'Unable to delete player at this time');
  }
}
