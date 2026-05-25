import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type Course, coursesApi } from '../../api/courses';

export interface CourseSelectorProps {
  /** Currently selected course */
  value?: Course | null;
  /** Called when the user selects or clears a course */
  onChange: (course: Course | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CourseSelector({
  value,
  onChange,
  label,
  placeholder = 'Search courses…',
  disabled = false,
  className = '',
  id,
}: CourseSelectorProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Course[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  const loading = query.trim().length > 0 && query !== debouncedQuery;

  useEffect(() => {
    if (!debouncedQuery.trim()) return;
    let cancelled = false;
    coursesApi
      .list(1, 10, debouncedQuery)
      .then((res) => {
        if (!cancelled) {
          setOptions(res.data.data);
          setActiveIndex(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const open = options.length > 0 && query.trim().length > 0;

  const selectCourse = useCallback(
    (course: Course) => {
      onChange(course);
      setQuery('');
      setOptions([]);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const clearSelection = useCallback(() => {
    onChange(null);
    setQuery('');
    setOptions([]);
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) selectCourse(options[activeIndex]);
      } else if (e.key === 'Escape') {
        setQuery('');
        setOptions([]);
        setActiveIndex(-1);
      }
    },
    [open, options, activeIndex, selectCourse],
  );

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const inputId = id ?? 'course-selector';
  const listId = `${inputId}-list`;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
          <span className="flex-1 text-sm text-gray-900">
            {value.name}
            {value.city && <span className="ml-1 text-gray-500">· {value.city}</span>}
            <span className="ml-1 text-xs text-gray-400">{value.country}</span>
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="ml-1 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setOptions([]), 150)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50"
            autoComplete="off"
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              …
            </span>
          )}
        </div>
      )}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Course suggestions"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((course, index) => (
            <li
              key={course.id}
              id={`${inputId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={() => selectCourse(course)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-indigo-600 text-white' : 'text-gray-900 hover:bg-indigo-50'
              }`}
            >
              <span className="font-medium">{course.name}</span>
              {course.city && (
                <span className={`ml-2 text-xs ${index === activeIndex ? 'text-indigo-200' : 'text-gray-500'}`}>
                  {course.city}
                </span>
              )}
              <span className={`ml-2 text-xs ${index === activeIndex ? 'text-indigo-200' : 'text-gray-400'}`}>
                {course.country}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
