import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

function checkIsMobile(): boolean {
  // A phone in landscape has width > 768 but height < 500
  // Use the smaller dimension to detect phones vs tablets
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  return minDim <= MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    const handler = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
}
