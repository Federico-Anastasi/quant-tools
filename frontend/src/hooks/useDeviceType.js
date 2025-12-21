import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive device detection
 *
 * Breakpoints:
 * - Mobile: < 768px
 * - Tablet: 768px - 1023px
 * - Desktop: >= 1024px
 *
 * @returns {Object} { isMobile, isTablet, isDesktop }
 */
export const useDeviceType = () => {
  const getDeviceType = (width) => ({
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024
  });

  const [deviceType, setDeviceType] = useState(() =>
    getDeviceType(window.innerWidth)
  );

  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType(window.innerWidth));
    };

    // Throttle resize events for better performance
    let timeoutId;
    const throttledResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', throttledResize);

    return () => {
      window.removeEventListener('resize', throttledResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return deviceType;
};
