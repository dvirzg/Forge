import { useEffect, useRef, useState } from 'react';
import { appWindow, LogicalSize } from '@tauri-apps/api/window';
import { currentMonitor, primaryMonitor } from '@tauri-apps/api/window';

interface ToolsContainerProps {
  expandedCard: string | null;
  children: React.ReactNode;
}

export function ToolsContainer({ expandedCard, children }: ToolsContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [originalHeight, setOriginalHeight] = useState<number | null>(null);
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
  }, [expandedCard, isExpanded]);

  useEffect(() => {
    const handleWindowResize = async () => {
      if (!containerRef.current || !isExpanded) {
        if (originalHeight !== null) {
          try {
            const currentSize = await appWindow.innerSize();
            await appWindow.setSize(new LogicalSize(currentSize.width, originalHeight));
            setOriginalHeight(null);
          } catch (error) {
            console.error('Error restoring window size:', error);
          }
        }
        return;
      }

      try {
        const expandedElement = containerRef.current.querySelector(
          `[data-collapsible-id="${expandedCard}"]`
        ) as HTMLElement | null;

        if (!expandedElement) return;

        await new Promise(resolve => setTimeout(resolve, 50));

        const expandedRect = expandedElement.getBoundingClientRect();
        const expandedBottom = expandedRect.bottom;
        const viewportHeight = window.innerHeight;

        if (expandedBottom > viewportHeight) {
          const currentSize = await appWindow.innerSize();
          
          if (originalHeight === null) {
            setOriginalHeight(currentSize.height);
          }

          const additionalHeight = Math.ceil(expandedBottom - viewportHeight + 40);
          const newHeight = currentSize.height + additionalHeight;

          const primary = await primaryMonitor();
          const current = await currentMonitor();
          const monitor = primary || current;
          const maxHeight = monitor ? Math.floor(monitor.size.height * 0.9) : 2000;

          const finalHeight = Math.min(newHeight, maxHeight);
          if (finalHeight > currentSize.height) {
            await appWindow.setSize(new LogicalSize(currentSize.width, finalHeight));
          }
        } else if (originalHeight !== null) {
          const currentSize = await appWindow.innerSize();
          if (currentSize.height > originalHeight) {
            await appWindow.setSize(new LogicalSize(currentSize.width, originalHeight));
            setOriginalHeight(null);
          }
        }
      } catch (error) {
        console.error('Error resizing window:', error);
      }
    };

    const timeoutId = setTimeout(handleWindowResize, 150);
    return () => clearTimeout(timeoutId);
  }, [expandedCard, isExpanded, originalHeight]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-4 pb-2 px-1 ${isExpanded ? 'overflow-hidden' : 'overflow-y-auto overflow-x-visible'}`}
      style={{
        maxHeight: isExpanded ? '100%' : undefined,
      }}
    >
      {children}
    </div>
  );
}
