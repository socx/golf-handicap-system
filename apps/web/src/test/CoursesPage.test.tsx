import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import CoursesPage from '../pages/CoursesPage';

const authState = vi.hoisted(() => ({
  role: 'admin' as 'admin' | 'player' | 'viewer',
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ role: authState.role }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeMockResponse = (courses: any[] = [], pagination = { page: 1, limit: 10, total: 0, pages: 1 }) => ({
  data: { data: courses, pagination },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as never,
});

afterEach(() => {
  vi.restoreAllMocks();
  authState.role = 'admin';
});

describe('CoursesPage', () => {
  it('renders paginated courses and navigates to course detail route', async () => {
    const listSpy = vi.spyOn(coursesApi, 'list').mockResolvedValue(
      makeMockResponse(
        [
          {
            id: 'course-1',
            name: 'Harbour Links',
            address: '1 Links Road',
            city: 'Brighton',
            country: 'GB',
            phone: '01273 000111',
            email: 'info@harbourlinks.co.uk',
            website: 'https://harbourlinks.co.uk',
            created_at: '2026-05-25T00:00:00.000Z',
            updated_at: '2026-05-25T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        { page: 1, limit: 10, total: 1, pages: 2 },
      ) as never,
    );

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<div>Course detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Harbour Links');
    expect(listSpy).toHaveBeenCalledWith(1, 10, undefined, undefined);

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Course detail route')).toBeInTheDocument();
  });

  it('applies search and country filters in API calls', async () => {
    const listSpy = vi.spyOn(coursesApi, 'list').mockResolvedValue(makeMockResponse() as never);

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route path="/courses" element={<CoursesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('Search courses by name...'), {
      target: { value: 'harbour' },
    });
    fireEvent.change(screen.getByPlaceholderText('Filter by country...'), {
      target: { value: 'gb' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(1, 10, 'harbour', 'gb');
    });
  });

  it('keeps focus in filter input while typing', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue(makeMockResponse() as never);

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route path="/courses" element={<CoursesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const filterInput = await screen.findByPlaceholderText('Filter by country...');
    filterInput.focus();
    expect(filterInput).toHaveFocus();

    fireEvent.change(filterInput, { target: { value: 'G' } });
    await waitFor(() => {
      expect(filterInput).toHaveFocus();
    });
  });

  it('hides create course action for non-admin users', async () => {
    authState.role = 'player';
    vi.spyOn(coursesApi, 'list').mockResolvedValue(makeMockResponse() as never);

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route path="/courses" element={<CoursesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Create Course' })).not.toBeInTheDocument();
    });
  });
});
