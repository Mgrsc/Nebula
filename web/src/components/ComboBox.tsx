import { useState, useRef, useEffect } from "react";

export type ComboBoxOption = {
  value: string;
  label: string;
};

export default function ComboBox(props: {
  value: string;
  onChange: (value: string) => void;
  options: ComboBoxOption[];
  placeholder?: string;
  className?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(props.value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop value to internal input value if closed
  useEffect(() => {
    if (!open) {
      setInputValue(props.value);
    }
  }, [props.value, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // On blur, if not custom allowed, reset to props.value or pick closest match.
        // For simplicity, just fire onChange with current input (allowCustom defaults to true for our usage)
        if (props.allowCustom !== false) {
           props.onChange(inputValue);
        } else {
           setInputValue(props.value);
        }
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, inputValue, props]);

  const filteredOptions = props.options.filter(opt =>
    opt.label.toLowerCase().includes(inputValue.toLowerCase()) || 
    opt.value.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className={`relative ${props.className || ""}`} ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 transition-colors focus:border-sky-500/50"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!open) setOpen(true);
            if (props.allowCustom !== false) {
              props.onChange(e.target.value);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={props.placeholder}
        />
        <div 
          className="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer text-white/40 hover:text-white/80"
          onClick={() => {
            setOpen(!open);
            if (!open) inputRef.current?.focus();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>
      
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0f172a] shadow-xl shadow-black/50 animate-fade-in p-1 custom-scrollbar">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  props.value === opt.value
                    ? 'bg-sky-500/20 text-sky-400 font-medium'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => {
                  setInputValue(opt.value); // set value, not label, for the actual output
                  props.onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-white/40 italic">
              {props.allowCustom !== false ? 'Press enter to use custom value' : 'No matches'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
