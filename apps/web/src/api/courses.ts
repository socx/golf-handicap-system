import { api } from './client';

export interface TeeConfiguration {
  id: string;
  course_id: string;
  name: string;
  tee_colour: string;
  hole_count: number;
  course_rating: number;
  slope_rating: number;
  created_at: string;
  updated_at: string;
}

export interface Hole {
  id: string;
  tee_configuration_id: string;
  hole_number: number;
  distance_yards: number;
  par: number;
  stroke_index: number;
}

export interface TeeConfigurationDetail extends TeeConfiguration {
  holes: Hole[];
}

export interface TeeConfigurationCreatePayload {
  name: string;
  teeColour: string;
  courseRating?: number | null;
  slopeRating?: number | null;
  holes: Array<{
    holeNumber: number;
    distanceYards?: number | null;
    par: number;
    strokeIndex: number;
  }>;
}

export interface TeeConfigurationUpdatePayload {
  name?: string;
  teeColour?: string;
  courseRating?: number | null;
  slopeRating?: number | null;
}

export interface TeeHoleUpdatePayload {
  id: string;
  holeNumber?: number;
  distanceYards?: number | null;
  par?: number;
  strokeIndex?: number;
}

export interface Course {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tee_configurations?: TeeConfigurationDetail[];
}

export interface CoursesListResponse {
  data: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface RawCoursesListResponse {
  data?: Course[];
  courses?: Course[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
    totalPages?: number;
  };
}

interface RawHole {
  id?: string;
  tee_configuration_id?: string;
  teeConfigurationId?: string;
  hole_number?: number;
  holeNumber?: number;
  distance_yards?: number;
  distanceYards?: number;
  par?: number;
  stroke_index?: number;
  strokeIndex?: number;
}

interface RawTeeConfiguration {
  id?: string;
  course_id?: string;
  courseId?: string;
  name?: string;
  tee_colour?: string;
  teeColour?: string;
  hole_count?: number;
  holeCount?: number;
  course_rating?: number;
  courseRating?: number;
  slope_rating?: number;
  slopeRating?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  holes?: RawHole[];
}

interface RawCourse {
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  deleted_at?: string | null;
  deletedAt?: string | null;
  tee_configurations?: RawTeeConfiguration[];
  teeConfigurations?: RawTeeConfiguration[];
}

function normalizeHole(payload: RawHole): Hole {
  return {
    id: payload.id ?? '',
    tee_configuration_id: payload.tee_configuration_id ?? payload.teeConfigurationId ?? '',
    hole_number: payload.hole_number ?? payload.holeNumber ?? 0,
    distance_yards: payload.distance_yards ?? payload.distanceYards ?? 0,
    par: payload.par ?? 0,
    stroke_index: payload.stroke_index ?? payload.strokeIndex ?? 0,
  };
}

function normalizeTeeConfiguration(payload: RawTeeConfiguration): TeeConfigurationDetail {
  return {
    id: payload.id ?? '',
    course_id: payload.course_id ?? payload.courseId ?? '',
    name: payload.name ?? '',
    tee_colour: payload.tee_colour ?? payload.teeColour ?? '',
    hole_count: payload.hole_count ?? payload.holeCount ?? 0,
    course_rating: payload.course_rating ?? payload.courseRating ?? 0,
    slope_rating: payload.slope_rating ?? payload.slopeRating ?? 0,
    created_at: payload.created_at ?? payload.createdAt ?? '',
    updated_at: payload.updated_at ?? payload.updatedAt ?? '',
    holes: Array.isArray(payload.holes) ? payload.holes.map(normalizeHole) : [],
  };
}

export function normalizeCourse(payload: unknown): Course {
  const raw = (payload ?? {}) as RawCourse;
  const teeConfigurations = Array.isArray(raw.tee_configurations)
    ? raw.tee_configurations
    : Array.isArray(raw.teeConfigurations)
      ? raw.teeConfigurations
      : [];

  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    address: raw.address ?? '',
    city: raw.city ?? '',
    country: raw.country ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    website: raw.website ?? '',
    created_at: raw.created_at ?? raw.createdAt ?? '',
    updated_at: raw.updated_at ?? raw.updatedAt ?? '',
    deleted_at: raw.deleted_at ?? raw.deletedAt ?? null,
    tee_configurations: teeConfigurations.map(normalizeTeeConfiguration),
  };
}

export function normalizeCoursesListResponse(payload: unknown): CoursesListResponse {
  const raw = (payload ?? {}) as RawCoursesListResponse;
  const rawPagination = raw.pagination ?? {};

  const rawCourses = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.courses) ? raw.courses : [];

  return {
    data: rawCourses.map((course) => normalizeCourse(course)),
    pagination: {
      page: rawPagination.page ?? 1,
      limit: rawPagination.limit ?? 10,
      total: rawPagination.total ?? 0,
      pages: rawPagination.pages ?? rawPagination.totalPages ?? 1,
    },
  };
}

export const coursesApi = {
  list: (page = 1, limit = 10, search?: string, country?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    if (country) params.append('country', country);
    return api.get<unknown>(`/courses?${params.toString()}`).then((response) => ({
      ...response,
      data: normalizeCoursesListResponse(response.data),
    }));
  },

  get: (courseId: string) => api.get<unknown>(`/courses/${courseId}`).then((response) => ({
    ...response,
    data: normalizeCourse(response.data),
  })),
  createConfiguration: (courseId: string, payload: TeeConfigurationCreatePayload) =>
    api.post<TeeConfigurationDetail>(`/courses/${courseId}/configurations`, payload),
  updateConfiguration: (configId: string, payload: TeeConfigurationUpdatePayload) =>
    api.patch<TeeConfigurationDetail>(`/configurations/${configId}`, payload),
  updateConfigurationHoles: (configId: string, holes: TeeHoleUpdatePayload[]) =>
    api.patch<{ holes: Hole[] }>(`/configurations/${configId}`, { holes }),
};
