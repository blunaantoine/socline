'use client';

import { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface HideableBalanceProps {
  balance: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  balanceClassName?: string;
  storageKey?: string;
  showToggle?: boolean;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

const maskedValues = {
  sm: '**** F',
  md: '**** F',
  lg: '***** F',
  xl: '******* F',
};

// Helper function to get initial hidden state from localStorage
function getInitialHiddenState(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(storageKey);
  return stored === 'true';
}

export function HideableBalance({
  balance,
  currency = 'F',
  size = 'lg',
  className = '',
  balanceClassName = '',
  storageKey = 'hide-balance',
  showToggle = true,
}: HideableBalanceProps) {
  const [isHidden, setIsHidden] = useState(() => getInitialHiddenState(storageKey));

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setIsHidden((prev) => {
      const newValue = !prev;
      localStorage.setItem(storageKey, String(newValue));
      return newValue;
    });
  }, [storageKey]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-bold ${sizeClasses[size]} ${balanceClassName}`}>
        {isHidden 
          ? maskedValues[size]
          : `${balance.toLocaleString()} ${currency}`
        }
      </span>
      {showToggle && (
        <button
          onClick={toggleVisibility}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          title={isHidden ? 'Afficher le solde' : 'Cacher le solde'}
        >
          {isHidden ? (
            <EyeOff className="w-5 h-5 text-white/80" />
          ) : (
            <Eye className="w-5 h-5 text-white/80" />
          )}
        </button>
      )}
    </div>
  );
}

// Version for dark backgrounds (default)
export function HideableBalanceDark({
  balance,
  currency = 'F',
  size = 'lg',
  className = '',
  balanceClassName = '',
  storageKey = 'hide-balance',
  showToggle = true,
}: HideableBalanceProps) {
  const [isHidden, setIsHidden] = useState(() => getInitialHiddenState(storageKey));

  const toggleVisibility = useCallback(() => {
    setIsHidden((prev) => {
      const newValue = !prev;
      localStorage.setItem(storageKey, String(newValue));
      return newValue;
    });
  }, [storageKey]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-bold ${sizeClasses[size]} text-white ${balanceClassName}`}>
        {isHidden 
          ? maskedValues[size]
          : `${balance.toLocaleString()} ${currency}`
        }
      </span>
      {showToggle && (
        <button
          onClick={toggleVisibility}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          title={isHidden ? 'Afficher le solde' : 'Cacher le solde'}
        >
          {isHidden ? (
            <EyeOff className="w-5 h-5 text-white/80" />
          ) : (
            <Eye className="w-5 h-5 text-white/80" />
          )}
        </button>
      )}
    </div>
  );
}

// Version for light backgrounds
export function HideableBalanceLight({
  balance,
  currency = 'F',
  size = 'lg',
  className = '',
  balanceClassName = '',
  storageKey = 'hide-balance',
  showToggle = true,
}: HideableBalanceProps) {
  const [isHidden, setIsHidden] = useState(() => getInitialHiddenState(storageKey));

  const toggleVisibility = useCallback(() => {
    setIsHidden((prev) => {
      const newValue = !prev;
      localStorage.setItem(storageKey, String(newValue));
      return newValue;
    });
  }, [storageKey]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-bold ${sizeClasses[size]} ${balanceClassName}`}>
        {isHidden 
          ? maskedValues[size]
          : `${balance.toLocaleString()} ${currency}`
        }
      </span>
      {showToggle && (
        <button
          onClick={toggleVisibility}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          title={isHidden ? 'Afficher le solde' : 'Cacher le solde'}
        >
          {isHidden ? (
            <EyeOff className="w-4 h-4 text-gray-500" />
          ) : (
            <Eye className="w-4 h-4 text-gray-500" />
          )}
        </button>
      )}
    </div>
  );
}

export default HideableBalance;
