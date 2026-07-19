import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, leftElement, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-surface-700"
          >
            {label}
          </label>
        )}
        <div className="relative w-full">
          {leftElement && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-4 py-2.5 rounded-xl
              border-2 border-surface-200
              bg-white text-surface-800
              placeholder:text-surface-400
              transition-all duration-200
              focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-100
              disabled:bg-surface-100 disabled:cursor-not-allowed
              ${leftElement ? 'pl-10' : ''}
              ${rightElement ? 'pr-12' : ''}
              ${error ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100' : ''}
              ${className}
            `}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-danger-600 flex items-center gap-1">
            <span>⚠️</span> {error}
          </p>
        )}
        {helpText && !error && (
          <p className="text-sm text-surface-500">{helpText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
