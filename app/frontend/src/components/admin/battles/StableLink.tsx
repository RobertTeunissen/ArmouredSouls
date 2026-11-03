/**
 * A stable's name in the admin battle views, linking to its detail panel on
 * Players (`/admin/players?user=`), which serves every stable type.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { StableRef } from './types';

export function StableLink({ stable, className = '' }: { stable: StableRef; className?: string }): ReactNode {
  return (
    <Link
      to={`/admin/players?user=${stable.userId}`}
      className={`hover:text-white hover:underline ${ADMIN_FOCUS_RING} ${className}`}
      title={`Open ${stable.name} on Players`}
    >
      {stable.name}
    </Link>
  );
}
