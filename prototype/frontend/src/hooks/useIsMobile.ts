import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024;

/**
 * Hook that returns true when the viewport width is below the mobile breakpoint (1024px).
 * Listens to resize events and cleans up on unmount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export default useIsMobile;
