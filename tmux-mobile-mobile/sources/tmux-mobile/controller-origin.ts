export const CONTROLLER_ORIGIN = "https://eng.xyznot.com";
const LEGACY_ORIGIN = "https://eng.impo.ai";

export function migrateControllerOrigin(origin: string): string {
  return origin === LEGACY_ORIGIN ? CONTROLLER_ORIGIN : origin;
}

export function migrateControllerSession<T extends { baseUrl: string }>(session: T): T {
  const baseUrl = migrateControllerOrigin(session.baseUrl);
  return baseUrl === session.baseUrl ? session : { ...session, baseUrl };
}
