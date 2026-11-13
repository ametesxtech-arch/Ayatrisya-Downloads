import * as React from 'react';

export const MOBILE_BREAKPOINT = 768;
export const TABLET_MAX_BREAKPOINT = 1024;
export const TABLET_LANDSCAPE_MAX = 1180;

export type DeviceType = 'mobile' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait = height >= width;

  if (width < MOBILE_BREAKPOINT) {
    return 'mobile';
  }
  if (width < TABLET_MAX_BREAKPOINT && isPortrait) {
    return 'tablet-portrait';
  }
  if (width <= TABLET_LANDSCAPE_MAX && !isPortrait) {
    return 'tablet-landscape';
  }
  return 'desktop';
}

/**
 * Standard phone check (width < 768px). Backwards compatible with existing sidebar / UI components.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  return isMobile;
}

/**
 * Tablet check (768px <= width <= 1024px)
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      return w >= MOBILE_BREAKPOINT && w <= TABLET_MAX_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w <= TABLET_MAX_BREAKPOINT);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return isTablet;
}

/**
 * Tablet Portrait check (768px <= width < 1024px in portrait mode)
 */
export function useIsTabletPortrait(): boolean {
  const [isTabletPortrait, setIsTabletPortrait] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return w >= MOBILE_BREAKPOINT && w < TABLET_MAX_BREAKPOINT && h >= w;
    }
    return false;
  });

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsTabletPortrait(w >= MOBILE_BREAKPOINT && w < TABLET_MAX_BREAKPOINT && h >= w);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return isTabletPortrait;
}

/**
 * Tablet Landscape check (768px <= width <= 1180px in landscape mode)
 */
export function useIsTabletLandscape(): boolean {
  const [isTabletLandscape, setIsTabletLandscape] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return w >= MOBILE_BREAKPOINT && w <= TABLET_LANDSCAPE_MAX && w > h;
    }
    return false;
  });

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsTabletLandscape(w >= MOBILE_BREAKPOINT && w <= TABLET_LANDSCAPE_MAX && w > h);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return isTabletLandscape;
}

/**
 * Returns true if the screen should use a tabbed, single-panel layout:
 * true for phones (< 768px) and tablet portrait (768px <= width < 1024px).
 */
export function useIsTabbedLayout(): boolean {
  const [isTabbed, setIsTabbed] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return w < MOBILE_BREAKPOINT || (w < TABLET_MAX_BREAKPOINT && h >= w);
    }
    return false;
  });

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsTabbed(w < MOBILE_BREAKPOINT || (w < TABLET_MAX_BREAKPOINT && h >= w));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return isTabbed;
}

/**
 * Reactive device type state
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = React.useState<DeviceType>(getDeviceType);

  React.useEffect(() => {
    const onResize = () => {
      setDeviceType(getDeviceType());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return deviceType;
}

