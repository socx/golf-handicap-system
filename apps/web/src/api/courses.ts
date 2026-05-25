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

export function normalizeCoursesListResponse(payload: unknown): CoursesListResponse {
  const raw = (payload ?? {}) as RawCoursesListResponse;
  const rawPagination = raw.pagination ?? {};

  return {
    data: Array.isArray(raw.data) ? raw.data : Array.isArray(raw.courses) ? raw.courses : [],
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

  get: (courseId: string) => api.get<Course>(`/courses/${courseId}`),
  createConfiguration: (courseId: string, payload: TeeConfigurationCreatePayload) =>
    api.post<TeeConfigurationDetail>(`/courses/${courseId}/configurations`, payload),
  updateConfiguration: (configId: string, payload: TeeConfigurationUpdatePayload) =>
    api.patch<TeeConfigurationDetail>(`/configurations/${configId}`, payload),
  updateConfigurationHoles: (configId: string, holes: TeeHoleUpdatePayload[]) =>
    api.patch<{ holes: Hole[] }>(`/configurations/${configId}`, { holes }),
};
