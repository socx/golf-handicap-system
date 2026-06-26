import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi, type GlobalSearchSuggestion } from '../../api/search';

const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GlobalSearchSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await searchApi.global(query.trim(), 6);
        if (!cancelled) {
          setSuggestions(response.suggestions);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="relative hidden w-80 lg:block">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search players, rounds, courses..."
        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      {suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-11 z-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {suggestions.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                navigate(item.path);
                setQuery('');
                setSuggestions([]);
              }}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
              {item.subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default GlobalSearch;
