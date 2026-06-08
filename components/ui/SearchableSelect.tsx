'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Dropdown buscable con filtrado por texto (sin distinguir acentos/mayúsculas).
 *
 * Dos modos:
 *   - simple:   value:string  + onChange(value:string)
 *   - múltiple: multiple + values:string[] + onChange(values:string[])
 *
 * Pensado para listas largas (138 géneros, 38 roles de intérprete…) donde el
 * <select> nativo no escala. Reutiliza la estética pill del design system.
 */

/** Quita acentos y pasa a minúsculas para comparar/filtrar sin importar tildes. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface BaseProps {
  options: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  values: string[];
  onChange: (values: string[]) => void;
}

type Props = SingleProps | MultiProps;

export default function SearchableSelect(props: Props) {
  const {
    options,
    placeholder = 'elige…',
    searchPlaceholder = 'escribe para filtrar…',
    disabled = false,
    id,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected: string[] = props.multiple
    ? props.values
    : props.value
      ? [props.value]
      : [];

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    return options.filter((o) => norm(o).includes(q));
  }, [options, query]);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Al abrir: limpiar búsqueda y enfocar el input de filtro
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const choose = (opt: string) => {
    if (props.multiple) {
      const set = new Set(props.values);
      if (set.has(opt)) set.delete(opt);
      else set.add(opt);
      props.onChange(Array.from(set));
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      props.onChange(opt);
      setOpen(false);
    }
  };

  const removeChip = (opt: string) => {
    if (props.multiple) props.onChange(props.values.filter((v) => v !== opt));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) choose(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      className={`ss ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        id={id}
        className="ss-control input-pill"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {props.multiple ? (
          selected.length ? (
            <span className="ss-chips">
              {props.values.map((v) => (
                <span
                  key={v}
                  className="ss-chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(v);
                  }}
                >
                  {v}
                  <span className="ss-chip-x">✕</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="ss-placeholder">{placeholder}</span>
          )
        ) : props.value ? (
          <span className="ss-value">{props.value}</span>
        ) : (
          <span className="ss-placeholder">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="ss-panel">
          <input
            ref={inputRef}
            className="ss-search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
          />
          <div className="ss-list" role="listbox">
            {filtered.length === 0 && (
              <div className="ss-empty">sin resultados</div>
            )}
            {filtered.map((opt, i) => {
              const isSel = selected.includes(opt);
              return (
                <div
                  key={opt}
                  role="option"
                  aria-selected={isSel}
                  className={`ss-option ${isSel ? 'sel' : ''} ${i === highlight ? 'hl' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(opt)}
                >
                  <span>{opt}</span>
                  {isSel && <span className="ss-check">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
