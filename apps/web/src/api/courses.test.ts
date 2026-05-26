import { describe, expect, it, vi, afterEach } from 'vitest';
import { api } from './client';
import { coursesApi, normalizeCourse, normalizeCoursesListResponse } from './courses';

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

describe('normalizeCourse', () => {
  it('normalizes camelCase course detail payload to snake_case fields', () => {
    const normalized = normalizeCourse({
      id: 'course-1',
      name: 'Royal Glen',
      city: 'St Andrews',
      country: 'GB',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      teeConfigurations: [
        {
          id: 'cfg-1',
          courseId: 'course-1',
          name: 'Members',
          teeColour: 'White',
          holeCount: 9,
          courseRating: 67.2,
          slopeRating: 121,
          holes: [
            {
              id: 'hole-1',
              teeConfigurationId: 'cfg-1',
              holeNumber: 1,
              distanceYards: 350,
              par: 4,
              strokeIndex: 1,
            },
          ],
        },
      ],
    });

    expect(normalized.tee_configurations).toHaveLength(1);
    expect(normalized.tee_configurations?.[0]?.tee_colour).toBe('White');
    expect(normalized.tee_configurations?.[0]?.holes?.[0]?.hole_number).toBe(1);
    expect(normalized.created_at).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('coursesApi.get', () => {
  it('normalizes course detail response so tee configurations can be rendered', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        id: 'course-1',
        name: 'Royal Glen',
        city: 'St Andrews',
        country: 'GB',
        teeConfigurations: [
          {
            id: 'cfg-1',
            courseId: 'course-1',
            name: 'Members',
            teeColour: 'White',
            holeCount: 9,
            courseRating: 67.2,
            slopeRating: 121,
            holes: [],
          },
        ],
      },
    } as never);

    const response = await coursesApi.get('course-1');

    expect(response.data.tee_configurations).toHaveLength(1);
    expect(response.data.tee_configurations?.[0]?.name).toBe('Members');
    expect(response.data.tee_configurations?.[0]?.tee_colour).toBe('White');
  });
});

describe('tee configuration API helpers', () => {
  it('calls create configuration endpoint', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'cfg-1' } } as never);

    await coursesApi.createConfiguration('course-1', {
      name: 'Members',
      teeColour: 'White',
      holes: [
        {
          holeNumber: 1,
          distanceYards: 350,
          par: 4,
          strokeIndex: 1,
        },
      ],
    });

    expect(postSpy).toHaveBeenCalledWith('/courses/course-1/configurations', expect.any(Object));
  });

  it('calls update configuration metadata and holes endpoints', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} } as never);

    await coursesApi.updateConfiguration('cfg-1', { name: 'Updated' });
    await coursesApi.updateConfigurationHoles('cfg-1', [
      {
        id: 'hole-1',
        par: 5,
      },
    ]);

    expect(patchSpy).toHaveBeenNthCalledWith(1, '/configurations/cfg-1', { name: 'Updated' });
    expect(patchSpy).toHaveBeenNthCalledWith(2, '/configurations/cfg-1', {
      holes: [{ id: 'hole-1', par: 5 }],
    });
  });
});
