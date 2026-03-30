'use client';

import { useSession } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user
      ? {
          id: (session.user as any).id as string,
          username: (session.user as any).username as string,
          name: session.user.name || '',
          email: session.user.email || '',
          role: (session.user as any).role as string,
          languagePref: (session.user as any).languagePref as string,
          themePref: (session.user as any).themePref as string,
        }
      : null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}
