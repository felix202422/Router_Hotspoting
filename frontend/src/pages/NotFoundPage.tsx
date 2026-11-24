import { Link } from 'react-router-dom';
import { Wifi } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white">
        <Wifi size={26} aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you are looking for doesn’t exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-electric-600 px-5 text-sm font-semibold text-white hover:bg-electric-700"
      >
        Back to home
      </Link>
    </div>
  );
}
