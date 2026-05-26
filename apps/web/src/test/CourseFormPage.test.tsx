import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import CourseFormPage from '../pages/CourseFormPage';

afterEach(() => {
  vi.restoreAllMocks();
});

const mockCourse = {
  id: 'course-1',
  name: 'North Dunes',
  address: '1 Dunes Way',
  city: 'Liverpool',
  country: 'GB',
  phone: '0123 456 7890',
  email: 'info@northdunes.example',
  website: 'https://northdunes.example',
  created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-20T00:00:00.000Z',
  deleted_at: null,
  tee_configurations: [],
};

describe('CourseFormPage', () => {
  it('creates a course and redirects to detail page', async () => {
    const createSpy = vi.spyOn(coursesApi, 'create').mockResolvedValue({
      data: {
        ...mockCourse,
        id: 'course-2',
        name: 'Harbour Links',
      },
    } as never);

    render(
      <MemoryRouter initialEntries={['/courses/new']}>
        <Routes>
          <Route path="/courses/new" element={<CourseFormPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/course name/i), { target: { value: 'Harbour Links' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'gb' } });

    fireEvent.click(screen.getByRole('button', { name: /create course/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Harbour Links',
        country: 'GB',
      }));
    });

    expect(await screen.findByText('Course detail route')).toBeInTheDocument();
  });

  it('loads course data in edit mode and updates it', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: mockCourse } as never);
    const updateSpy = vi.spyOn(coursesApi, 'update').mockResolvedValue({
      data: {
        ...mockCourse,
        city: 'Manchester',
      },
    } as never);

    render(
      <MemoryRouter initialEntries={['/courses/course-1/edit']}>
        <Routes>
          <Route path="/courses/:courseId/edit" element={<CourseFormPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('North Dunes')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Manchester' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'course-1',
        expect.objectContaining({ city: 'Manchester' }),
      );
    });

    expect(await screen.findByText('Course detail route')).toBeInTheDocument();
  });

  it('shows validation errors and blocks submit when data is invalid', async () => {
    const createSpy = vi.spyOn(coursesApi, 'create').mockResolvedValue({ data: mockCourse } as never);

    render(
      <MemoryRouter initialEntries={['/courses/new']}>
        <Routes>
          <Route path="/courses/new" element={<CourseFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'GBR' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/website/i), { target: { value: 'invalid-url' } });

    fireEvent.click(screen.getByRole('button', { name: /create course/i }));

    expect(await screen.findByText('Course name is required.')).toBeInTheDocument();
    expect(screen.getByText('Country must be a 2-letter ISO code.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid website URL.')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
