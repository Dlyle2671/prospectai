// Admin page — redirects to /admin-portal (new URL with fresh chunk)
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin-portal');
  }, []);
  return null;
}
