import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import { AuthContext } from '../context/auth-context';
import type { AuthContextValue } from '../context/auth-context';
import CourseDetailPage from '../pages/CourseDetailPage';

afterEach(() => {
  vi.restoreAllMocks();
});

const baseCourse = {
  id: 'course-1',
  name: 'Royal Links',
  address: '1 Links Way',
  city: 'St Andrews',
  country: 'GB',
  phone: '01234 567890',
  email: 'info@royallinks.example',
  website: 'https://royallinks.example',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tee_configurations: [
    {
      id: 'cfg-1',
      course_id: 'course-1',
      name: 'Members',
      tee_colour: 'White',
      hole_count: 9,
      course_rating: 67.2,
      slope_rating: 121,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      holes: [],
    },
  ],
};

function makeAuthValue(role: 'admin' | 'player'): AuthContextValue {
  return {
    user: { id: 'user-1', email: 'user@example.com', role, is_active: true },
    role,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    refreshUser: vi.fn(async () => {}),
  };
}

function renderPage(role: 'admin' | 'player' = 'admin') {
  return render(
    <AuthContext.Provider value={makeAuthValue(role)}>
      <MemoryRouter initialEntries={['/courses/course-1']}>
        <Routes>
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/courses" element={<div>Courses list</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('CourseDetailPage', () => {
  it('shows delete action for admin users and removes configuration from the UI after success', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: baseCourse } as never);
    const deleteSpy = vi.spyOn(coursesApi, 'deleteConfiguration').mockResolvedValue({
      data: {
        message: 'Tee configuration deleted',
        configId: 'cfg-1',
        courseId: 'course-1',
      },
    } as never);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage('admin');

    expect(await screen.findByText('Members')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete configuration/i }));

    expect(confirmSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('cfg-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Members')).not.toBeInTheDocument();
    });
  });

  it('does not show delete action for non-admin users', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: baseCourse } as never);

    renderPage('player');

    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete configuration/i })).not.toBeInTheDocument();
  });

  it('surfaces delete errors clearly', async () => {
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: baseCourse } as never);
    vi.spyOn(coursesApi, 'deleteConfiguration').mockRejectedValue(new Error('Permission denied'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage('admin');

    expect(await screen.findByText('Members')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete configuration/i }));

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
  });
});