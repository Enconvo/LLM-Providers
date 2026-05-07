import path from "path";
import { fileURLToPath } from "url";

export function normalizeImageSourceUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  if (/^data:image\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (/^file:\/\//i.test(trimmedUrl)) {
    try {
      return path.normalize(fileURLToPath(trimmedUrl));
    } catch {
      return path.normalize(trimmedUrl.replace(/^file:\/\//i, ""));
    }
  }

  if (/^https?:\/\//i.test(trimmedUrl)) {
    try {
      const parsedUrl = new URL(trimmedUrl);
      parsedUrl.hash = "";
      return parsedUrl.toString();
    } catch {
      return trimmedUrl;
    }
  }

  try {
    return path.normalize(decodeURI(trimmedUrl));
  } catch {
    return path.normalize(trimmedUrl);
  }
}

export function shouldAddImageSource(
  seenImageSources: Set<string>,
  url: string,
): boolean {
  const normalizedUrl = normalizeImageSourceUrl(url);
  if (!normalizedUrl) {
    return true;
  }
  if (seenImageSources.has(normalizedUrl)) {
    return false;
  }
  seenImageSources.add(normalizedUrl);
  return true;
}
