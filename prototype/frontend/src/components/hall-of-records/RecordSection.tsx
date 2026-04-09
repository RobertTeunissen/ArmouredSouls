import type { ReactNode } from 'react';

export interface RecordSectionProps {
  title: string;
  children: ReactNode;
}

export function RecordSection({ title, children }: RecordSectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-secondary mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
