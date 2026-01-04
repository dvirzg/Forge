import { useEffect } from 'react';
import { useToolsContainerResize, LAYOUT_CONSTANTS } from '../../hooks/useWindowResize';

interface ToolsContainerProps {
  expandedCard: string | null;
  children: React.ReactNode;
}

export function ToolsContainer({ expandedCard, children }: ToolsContainerProps) {
  const containerRef = useToolsContainerResize(expandedCard);
  const isExpanded = expandedCard !== null;

  useEffect(() => {
    if (!containerRef.current) return;

    if (isExpanded) {
      const allCards = containerRef.current.querySelectorAll('[data-collapsible-id]');
      allCards.forEach((card) => {
        const cardId = card.getAttribute('data-collapsible-id');
        if (cardId !== expandedCard) {
          (card as HTMLElement).style.display = 'none';
        } else {
          (card as HTMLElement).style.display = 'block';
        }
      });
    } else {
      const allCards = containerRef.current.querySelectorAll('[data-collapsible-id]');
      allCards.forEach((card) => {
        (card as HTMLElement).style.display = 'block';
      });
    }
  }, [expandedCard, isExpanded, containerRef]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-4 pb-1 px-1 ${isExpanded ? 'overflow-hidden' : 'overflow-y-auto overflow-x-visible'}`}
      style={{
        maxHeight: isExpanded ? '100%' : undefined,
        minHeight: LAYOUT_CONSTANTS.TOOLBAR_MIN_HEIGHT,
        width: LAYOUT_CONSTANTS.TOOLBAR_WIDTH,
      }}
    >
      {children}
    </div>
  );
}
