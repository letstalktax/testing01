'use client';

import { useEffect, useState } from 'react';
import { getApps } from 'firebase/app';
import { app } from './config';

export function FirebaseInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if Firebase is initialized
    if (app && getApps().length > 0) {
      setIsInitialized(true);
    }
  }, []);

  if (!isInitialized) {
    return <div>Initializing...</div>;
  }

  return <>{children}</>;
} 