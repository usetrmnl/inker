import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
  /** Optional hint shown next to label (e.g., matched city name) */
  hint?: string;
  /** Optional group header - if set, this is a non-selectable group divider */
  isGroup?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  /** Custom search function - receives query, returns filtered/sorted options */
  searchFn?: (query: string) => Option[];
}

/**
 * Searchable select component with autocomplete
 * Type to filter options, click or press Enter to select
 * Supports custom search function for advanced matching (e.g., city-to-timezone)
 * Uses Portal to render dropdown above all other elements
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  className = '',
  searchFn,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get display label for current value
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption?.label || value || '';

  // Filter options based on search term - use custom searchFn if provided
  const filteredOptions = useMemo(() => {
    if (searchFn) {
      return searchFn(searchTerm);
    }
    if (!searchTerm) return options;
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options, searchFn]);

  // Calculate dropdown position when opening (fixed position = viewport coordinates)
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap below input
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update position when opening and on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);


  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    inputRef.current?.blur();
  }, [onChange]);

  // Find next selectable index (skip group headers)
  const findNextSelectableIndex = useCallback((currentIndex: number, direction: 'up' | 'down'): number => {
    const step = direction === 'down' ? 1 : -1;
    let nextIndex = currentIndex + step;

    while (nextIndex >= 0 && nextIndex < filteredOptions.length) {
      if (!filteredOptions[nextIndex].isGroup) {
        return nextIndex;
      }
      nextIndex += step;
    }
    return currentIndex; // Stay at current if no valid option found
  }, [filteredOptions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => findNextSelectableIndex(prev, 'down'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => findNextSelectableIndex(prev, 'up'));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].isGroup) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  // Render dropdown in a portal to escape overflow containers
  // Use explicit white background as fallback for CSS variable
  const dropdownContent = isOpen && createPortal(
    <ul
      ref={listRef}
      className="fixed max-h-60 overflow-auto border-2 border-border-light rounded-lg shadow-2xl bg-white"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 99999,
      }}
    >
      {filteredOptions.length === 0 ? (
        <li className="px-3 py-2 text-sm text-text-muted bg-white">
          No matches found
        </li>
      ) : (
        filteredOptions.map((option, index) => (
          option.isGroup ? (
            // Group header - non-selectable, solid background
            <li
              key={`group-${option.value}`}
              className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border-light sticky top-0 bg-gray-100"
            >
              {option.label}
            </li>
          ) : (
            <li
              key={option.value}
              className={`
                px-3 py-2 text-sm cursor-pointer transition-colors
                ${index === highlightedIndex
                  ? 'text-accent bg-green-50'
                  : 'text-text-primary bg-white'
                }
                ${option.value === value ? 'font-medium' : ''}
              `}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="flex items-center gap-2">
                <span>{option.label}</span>
                {option.hint && (
                  <span className="text-xs text-text-muted opacity-70">
                    ← {option.hint}
                  </span>
                )}
                {option.value === value && (
                  <span className="ml-auto text-accent">✓</span>
                )}
              </span>
            </li>
          )
        ))
      )}
    </ul>,
    document.body
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-text
          bg-bg-input text-text-primary text-sm
          transition-all duration-200
          ${isOpen
            ? 'border-accent ring-1 ring-accent/20'
            : 'border-border-light hover:border-border-default'
          }
        `}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : displayValue || placeholder}
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
        />
        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {dropdownContent}
    </div>
  );
}
