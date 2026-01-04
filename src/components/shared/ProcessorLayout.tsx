interface ProcessorLayoutProps {
  preview: React.ReactNode;
  sidebar: React.ReactNode;
  layout?: 'flex' | 'grid-2' | 'grid-3';
}

/**
 * Shared layout component for processors
 * Provides consistent preview + sidebar layout
 */
export function ProcessorLayout({
  preview,
  sidebar,
  layout = 'flex',
}: ProcessorLayoutProps) {
  if (layout === 'grid-2') {
    return (
      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        <div className="flex items-center justify-center">{preview}</div>
        <div className="flex flex-col gap-4 overflow-y-auto">{sidebar}</div>
      </div>
    );
  }

  if (layout === 'grid-3') {
    return (
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        <div className="col-span-2">{preview}</div>
        <div className="flex flex-col gap-4 overflow-y-auto">{sidebar}</div>
      </div>
    );
  }

  // Default flex layout
  return (
    <div className="flex-1 flex gap-6 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">{preview}</div>
      <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-6">
        {sidebar}
      </div>
    </div>
  );
}
