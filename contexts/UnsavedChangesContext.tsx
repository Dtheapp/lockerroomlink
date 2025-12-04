import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  saveChanges: (() => Promise<void>) | null;
  setSaveChanges: (fn: (() => Promise<void>) | null) => void;
  clearChanges: (() => void) | null;
  setClearChanges: (fn: (() => void) | null) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveChanges, setSaveChanges] = useState<(() => Promise<void>) | null>(null);
  const [clearChanges, setClearChanges] = useState<(() => void) | null>(null);

  return (
    <UnsavedChangesContext.Provider 
      value={{ 
        hasUnsavedChanges, 
        setHasUnsavedChanges,
        saveChanges,
        setSaveChanges: useCallback((fn) => setSaveChanges(() => fn), []),
        clearChanges,
        setClearChanges: useCallback((fn) => setClearChanges(() => fn), []),
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
};
