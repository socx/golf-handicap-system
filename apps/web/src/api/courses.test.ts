import { describe, expect, it, vi, afterEach } from 'vitest';
import { api } from './client';
import { coursesApi, normalizeCoursesListResponse } from './courses';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeCoursesListResponse', () => {
  it('supports backend payload with courses and totalPages', () => {
    const normalized = normalizeCoursesListResponse({
      courses: [{ id: '1', name: 'Royal Glen' }],
      pagination: { page: 2, limit: 10, total: 35, totalPages: 4 },
    });

    expect(normalized.data).toHaveLength(1);
    expect(normalized.data[0]?.id).toBe('1');
    expect(normalized.pagination).toEqual({ page: 2, limit: 10, total: 35, pages: 4 });
  });

  it('supports legacy payload with data and pages', () => {
    const normalized = normalizeCoursesListResponse({
      data: [{ id: '2', name: 'Sunset Golf' }],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });

    expect(normalized.data).toHaveLength(1);
    expect(normalized.data[0]?.id).toBe('2');
    expect(normalized.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });
});

describe('coursesApi.list', () => {
  it('returns normalized data for current backend response shape', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        courses: [{ id: '3', name: 'Coastal Dunes' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    } as never);

    const response = await coursesApi.list(1, 10);

    expect(response.data.data).toHaveLength(1);
    expect(response.data.data[0]?.id).toBe('3');
    expect(response.data.pagination.pages).toBe(1);
  });
});
