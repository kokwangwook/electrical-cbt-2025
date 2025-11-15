/**
 * 디바이스 감지 유틸리티
 */

/**
 * 모바일 디바이스인지 확인
 */
export function isMobileDevice(): boolean {
  // User Agent 기반 감지
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  // 화면 크기 기반 감지 (추가 확인)
  const isSmallScreen = window.innerWidth <= 768;
  
  return mobileRegex.test(userAgent) || isSmallScreen;
}

/**
 * 태블릿 디바이스인지 확인
 */
export function isTabletDevice(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;
  const isTabletSize = window.innerWidth > 768 && window.innerWidth <= 1024;
  
  return tabletRegex.test(userAgent) || isTabletSize;
}

/**
 * 데스크톱 디바이스인지 확인
 */
export function isDesktopDevice(): boolean {
  return !isMobileDevice() && !isTabletDevice();
}

/**
 * 화면 너비가 특정 크기 이하인지 확인
 */
export function isSmallScreen(maxWidth: number = 768): boolean {
  return window.innerWidth <= maxWidth;
}

