/** Resolve only the Controller's recognized clean release labels. */
export function deployedRevisionCommit(revision) {
  if (typeof revision !== "string") return null;
  return /^([0-9a-f]{7,40})-(?:\d{8}T\d{6}Z|skills-\d{8})$/.exec(revision)?.[1] || null;
}
