'use client';

import { useEffect, useState } from 'react';

interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setUser(json.data);
      })
      .catch(() => {});
  }, []);

  return {
    user,
    isAdmin: user?.role === 'ADMIN',
  };
}
