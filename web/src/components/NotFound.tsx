import { Link } from 'react-router';
import { PageHeader } from './ui';

export function NotFound({ title = 'Page not found', backTo = '/', backLabel = 'Go to your progress' }) {
  return (
    <>
      <PageHeader title={title} />
      <Link to={backTo} className="text-indigo-600 hover:underline dark:text-indigo-400">
        {backLabel}
      </Link>
    </>
  );
}
