export type DevicePlatform = "windows" | "macos" | "linux" | "ios" | "android" | "unknown";

export interface BrowserPlatformInfo {
  userAgentDataPlatform?: string;
  platform?: string;
  userAgent?: string;
  maxTouchPoints?: number;
}

export function detectDevicePlatform(info: BrowserPlatformInfo): DevicePlatform {
  const value = `${info.userAgentDataPlatform ?? ""} ${info.platform ?? ""} ${info.userAgent ?? ""}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(value) || (/(macintosh|macintel)/.test(value) && (info.maxTouchPoints ?? 0) > 1)) return "ios";
  if (/android/.test(value)) return "android";
  if (/windows/.test(value) || /^win/.test((info.platform ?? "").toLowerCase())) return "windows";
  if (/macintosh|mac os|macintel/.test(value) || /^mac/.test((info.platform ?? "").toLowerCase())) return "macos";
  if (/linux|x11/.test(value)) return "linux";
  return "unknown";
}
