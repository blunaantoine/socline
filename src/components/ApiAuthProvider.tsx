'use client';

// Mounted once in the root layout. Importing this module installs the
// global fetch interceptor (Authorization: Bearer fallback for API calls
// when cookies are blocked, e.g. cross-site iframe preview panels).
import { installApiAuthInterceptor } from '@/lib/api-auth';

// Re-install on mount as a safety net (idempotent).
if (typeof window !== 'undefined') {
  installApiAuthInterceptor();
}

export function ApiAuthProvider() {
  installApiAuthInterceptor();
  return null;
}
