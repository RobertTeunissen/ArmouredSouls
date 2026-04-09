import { Link } from 'react-router-dom';

interface OwnerNameLinkProps {
  userId: number;
  displayName: string;
  className?: string;
}

function OwnerNameLink({ userId, displayName, className = '' }: OwnerNameLinkProps) {
  return (
    <Link
      to={`/stables/${userId}`}
      className={`text-primary hover:underline transition-colors ${className}`}
    >
      {displayName}
    </Link>
  );
}

export default OwnerNameLink;
