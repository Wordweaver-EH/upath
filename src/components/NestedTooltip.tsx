import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipPosition {
  x: number;
  y: number;
}

export interface NestedTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  depth?: number;
  isOpen?: boolean;
  onClose?: () => void;
  parentRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export const NestedTooltip: React.FC<NestedTooltipProps> = ({
  children,
  content,
  depth = 0,
  isOpen: controlledIsOpen,
  onClose,
  parentRef,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const actualIsOpen = controlledIsOpen !== undefined ? controlledIsOpen : isOpen;

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (controlledIsOpen !== undefined) return;
    
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;
      
      setPosition({ x, y });
      setIsOpen(true);
    }, 200);
  }, [controlledIsOpen]);

  const handleMouseLeave = useCallback(() => {
    if (controlledIsOpen !== undefined) return;
    
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  }, [controlledIsOpen]);

  const handleTooltipMouseEnter = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    if (controlledIsOpen !== undefined) {
      onClose?.();
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 300);
    }
  }, [controlledIsOpen, onClose]);

  // Adjust position to keep tooltip on screen
  useEffect(() => {
    if (!actualIsOpen || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = position.x;
    let newY = position.y - rect.height - 10;

    // Offset for nested tooltips
    const offset = depth * 20;
    newX += offset;
    newY += offset;

    // Keep within viewport
    if (newX + rect.width / 2 > viewportWidth - 10) {
      newX = viewportWidth - rect.width / 2 - 10;
    }
    if (newX - rect.width / 2 < 10) {
      newX = rect.width / 2 + 10;
    }
    if (newY < 10) {
      newY = position.y + 10;
    }

    setPosition({ x: newX, y: newY });
  }, [actualIsOpen, depth, position.x, position.y]);

  // Handle escape key
  useEffect(() => {
    if (!actualIsOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (controlledIsOpen !== undefined) {
          onClose?.();
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [actualIsOpen, controlledIsOpen, onClose]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {actualIsOpen && createPortal(
        <div
          ref={tooltipRef}
          className={`nested-tooltip depth-${depth} ${className}`}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 1000 + depth * 10,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <div className="nested-tooltip-content">
            {content}
          </div>
          <div 
            className="nested-tooltip-arrow"
            style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid var(--tooltip-bg)',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

// Hook for managing nested tooltip state
export function useNestedTooltip() {
  const [openTooltips, setOpenTooltips] = useState<Set<string>>(new Set());

  const openTooltip = useCallback((id: string) => {
    setOpenTooltips(prev => new Set(prev).add(id));
  }, []);

  const closeTooltip = useCallback((id: string) => {
    setOpenTooltips(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isTooltipOpen = useCallback((id: string) => {
    return openTooltips.has(id);
  }, [openTooltips]);

  return { openTooltip, closeTooltip, isTooltipOpen };
}