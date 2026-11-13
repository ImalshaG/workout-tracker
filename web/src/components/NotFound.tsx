import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import { buttonClass, EmptyState, PageHeader } from './ui';

export function NotFound({ title = 'Page not found', backTo = '/', backLabel = 'Go to your progress' }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={SearchX}
        title="Nothing here"
        action={
          <Link to={backTo} className={buttonClass('primary')}>
            {backLabel}
          </Link>
        }
      >
        The link may be out of date, or the item was deleted.
      </EmptyState>
    </>
  );
}
