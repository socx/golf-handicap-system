import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import CourseTeeConfigEditorPage from '../pages/CourseTeeConfigEditorPage';

afterEach(() => {
  vi.restoreAllMocks();
});

function baseCourse(courseOverrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    name: 'North Dunes',
    address: '1 Dunes Way',
    city: 'Liverpool',
    country: 'GB',
    phone: null,
    email: null,
    website: null,
    created_at: '2026-05-25T00:00:00.000Z',
    updated_at: '2026-05-25T00:00:00.000Z',
    deleted_at: null,
    tee_configurations: [],
    ...courseOverrides,
  };
}

describe('CourseTeeConfigEditorPage', () => {
  it('creates tee configuration and redirects to course detail', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: baseCourse() } as never);
    const createSpy = vi.spyOn(coursesApi, 'createConfiguration').mockResolvedValue({ data: {} } as never);

    render(
      <MemoryRouter initialEntries={['/courses/course-1/configurations/new']}>
        <Routes>
          <Route path="/courses/:courseId/configurations/new" element={<CourseTeeConfigEditorPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Create Tee Configuration' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Members' } });
    fireEvent.change(screen.getByLabelText('Tee Colour'), { target: { value: 'White' } });
    fireEvent.change(screen.getByLabelText('Course Rating'), { target: { value: '71.2' } });
    fireEvent.change(screen.getByLabelText('Slope Rating'), { target: { value: '128' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Configuration' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    const payload = createSpy.mock.calls[0]?.[1];
    expect(createSpy).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        name: 'Members',
        teeColour: 'White',
      }),
    );
    expect(payload?.holes).toHaveLength(9);

    expect(await screen.findByText('Course detail route')).toBeInTheDocument();
  });

  it('updates existing tee configuration metadata and holes', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({
      data: baseCourse({
        tee_configurations: [
          {
            id: 'config-1',
            course_id: 'course-1',
            name: 'Competition',
            tee_colour: 'Blue',
            hole_count: 9,
            course_rating: 72.4,
            slope_rating: 130,
            created_at: '2026-05-25T00:00:00.000Z',
            updated_at: '2026-05-25T00:00:00.000Z',
            holes: Array.from({ length: 9 }, (_, idx) => ({
              id: `hole-${idx + 1}`,
              tee_configuration_id: 'config-1',
              hole_number: idx + 1,
              distance_yards: 320 + idx,
              par: 4,
              stroke_index: idx + 1,
            })),
          },
        ],
      }),
    } as never);

    const updateMetadataSpy = vi.spyOn(coursesApi, 'updateConfiguration').mockResolvedValue({ data: {} } as never);
    const updateHolesSpy = vi.spyOn(coursesApi, 'updateConfigurationHoles').mockResolvedValue({ data: { holes: [] } } as never);

    render(
      <MemoryRouter initialEntries={['/courses/course-1/configurations/config-1/edit']}>
        <Routes>
          <Route path="/courses/:courseId/configurations/:configId/edit" element={<CourseTeeConfigEditorPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Edit Tee Configuration' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Competition Updated' } });
    fireEvent.change(screen.getByLabelText('Hole 1 par'), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateMetadataSpy).toHaveBeenCalledWith(
        'config-1',
        expect.objectContaining({ name: 'Competition Updated' }),
      );
      expect(updateHolesSpy).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Course detail route')).toBeInTheDocument();
  });

  it('shows validation errors clearly before save', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: baseCourse() } as never);
    const createSpy = vi.spyOn(coursesApi, 'createConfiguration').mockResolvedValue({ data: {} } as never);

    render(
      <MemoryRouter initialEntries={['/courses/course-1/configurations/new']}>
        <Routes>
          <Route path="/courses/:courseId/configurations/new" element={<CourseTeeConfigEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Create Tee Configuration' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Tee Colour'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Configuration' }));

    expect(await screen.findByText('Please fix the following validation errors:')).toBeInTheDocument();
    expect(screen.getByText('Configuration name is required.')).toBeInTheDocument();
    expect(screen.getByText('Tee colour is required.')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('prefills create mode from clone source and saves as a new configuration', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({
      data: baseCourse({
        tee_configurations: [
          {
            id: 'config-1',
            course_id: 'course-1',
            name: 'Competition',
            tee_colour: 'Blue',
            hole_count: 9,
            course_rating: 72.4,
            slope_rating: 130,
            created_at: '2026-05-25T00:00:00.000Z',
            updated_at: '2026-05-25T00:00:00.000Z',
            holes: Array.from({ length: 9 }, (_, idx) => ({
              id: `hole-${idx + 1}`,
              tee_configuration_id: 'config-1',
              hole_number: idx + 1,
              distance_yards: 320 + idx,
              par: 4,
              stroke_index: idx + 1,
            })),
          },
        ],
      }),
    } as never);
    const createSpy = vi.spyOn(coursesApi, 'createConfiguration').mockResolvedValue({ data: {} } as never);
    const updateSpy = vi.spyOn(coursesApi, 'updateConfiguration').mockResolvedValue({ data: {} } as never);

    render(
      <MemoryRouter initialEntries={['/courses/course-1/configurations/new?cloneFrom=config-1']}>
        <Routes>
          <Route path="/courses/:courseId/configurations/new" element={<CourseTeeConfigEditorPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Create Tee Configuration' });

    expect(screen.getByLabelText('Name')).toHaveValue('Competition (Copy)');
    expect(screen.getByLabelText('Tee Colour')).toHaveValue('Blue');
    expect(screen.getByLabelText('Hole 1 distance')).toHaveValue(320);

    fireEvent.click(screen.getByRole('button', { name: 'Create Configuration' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        name: 'Competition (Copy)',
        teeColour: 'Blue',
      }),
    );
  });
});
