const sensitivePathPatterns = [
  /(^|\/)\.env(?:\.[^/]*)?$/i,
  /(^|\/)[^/]+\.env$/i,
  /(^|\/)\.(?:npmrc|pypirc|netrc)$/i,
  /(^|\/)(?:credentials?(?:\.json)?|service[-_]?account(?:[-_][^/]*)?\.json|firebase-adminsdk[^/]*\.json)(\/|$)/i,
  /(^|\/)(?:\.ssh|\.aws|\.azure|\.gcloud|secrets?)(\/|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\.[^/]*)?$/i,
  /(^|\/)(?:id_rsa|id_ed25519|id_ecdsa)(?:\.pub)?$/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
];

const sensitiveValuePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|bearer|refresh[_-]?token|authorization|private[_-]?key|aws_secret_access_key)\s*[:=]\s*["']?[^\s"',;]{8,}/i,
  /\b[A-Z0-9_]*(?:API|ACCESS|SECRET|PRIVATE|SERVICE_ROLE|CLIENT|REFRESH|AUTH|SUPABASE|STRIPE|FIREBASE|AWS|GOOGLE|GITHUB|OPENAI|DATABASE|DB|REDIS|JWT|ENCRYPTION|SIGNING)[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|URL|CREDENTIALS)\s*[:=]\s*["']?[^\s"',;]{8,}/i,
  /\b(?:sk-[A-Za-z0-9_-]{20,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z_-]{20,}|npm_[A-Za-z0-9]{20,})\b/,
  /\b(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._~+/-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
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
