import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // ISO date format yyyy-MM-dd
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  label?: string;
  className?: string;
  error?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, onBlur, label, className = "", error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? parseISO(value) : undefined;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const commitTypedValue = () => {
    onBlur?.(inputValue);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="text-[10px] font-medium uppercase tracking-tight text-slate-600 mb-1 block">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          placeholder="YYYY-MM-DD"
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={commitTypedValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitTypedValue();
              event.currentTarget.blur();
            }
          }}
          className={`w-full bg-white border px-2 py-1.5 pr-8 text-[12px] text-slate-900 outline-none focus:border-slate-400 transition-colors ${error ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}
        />
        <button
          type="button"
          aria-label="Open calendar"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
        >
          <CalendarIcon 
            size={14} 
          />
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] font-medium text-red-600">{error}</p>}

      {isOpen && (
        <div className="absolute z-[110] mt-1 bg-white border border-slate-200 shadow-xl p-3 left-0 sm:left-auto sm:right-0">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            classNames={{
              root: "p-0",
              months: "space-y-4",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center mb-2 px-8",
              caption_label: "text-xs font-bold uppercase tracking-widest text-slate-900",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center hover:bg-slate-100 transition-colors",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex mb-1",
              head_cell: "text-slate-400 w-8 font-bold text-[10px] uppercase text-center",
              row: "flex w-full mt-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
              day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-100 flex items-center justify-center text-xs transition-colors",
              day_selected: "bg-slate-900 text-white hover:bg-slate-900 hover:text-white focus:bg-slate-900 focus:text-white cursor-default",
              day_today: "bg-slate-100 text-slate-900 font-bold",
              day_outside: "text-slate-300 opacity-50",
              day_disabled: "text-slate-300 opacity-50",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => <ChevronLeft size={16} />,
              IconRight: () => <ChevronRight size={16} />,
            }}
          />
        </div>
      )}
    </div>
  );
};
