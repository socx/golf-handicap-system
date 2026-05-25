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

export const coursesApi = {
  list: (page = 1, limit = 10, search?: string, country?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    if (country) params.append('country', country);
    return api.get<CoursesListResponse>(`/courses?${params.toString()}`);
  },

  get: (courseId: string) => api.get<Course>(`/courses/${courseId}`),
};
