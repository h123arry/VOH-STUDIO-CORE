const sensitivePathPatterns = [
  /(^|\/)\.env(?:\.[^/]*)?$/i,
  /(^|\/)[^/]+\.env$/i,
  /(^|\/)\.(?:npmrc|pypirc|netrc)$/i,
  /(^|\/)(?:credentials?(?:\.json)?|service[-_]?account(?:[-_][^/]*)?\.json|firebase-adminsdk[^/]*\.json)(\/|$)/i,
  /(^|\/)(?:\.ssh|\.aws|\.azure|\.gcloud|secrets?)(\/|$)/i,
  /(^|\/)(?:id_rsa|id_ed25519|id_ecdsa)(?:\.pub)?$/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
];

const sensitiveValuePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z_-]{20,}|npm_[A-Za-z0-9]{20,})\b/,
  /\b(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._~+/-]{8,}/i,
];

export function isSensitiveProjectPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return sensitivePathPatterns.some(pattern => pattern.test(normalized));
}

export function containsSensitiveValue(value: string) {
  return sensitiveValuePatterns.some(pattern => pattern.test(value));
}

export function isSafeProjectContextFile(filePath: string, content: string) {
  return !isSensitiveProjectPath(filePath) && !containsSensitiveValue(content);
}
