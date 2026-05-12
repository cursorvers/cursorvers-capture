export function buildFilename(
  shot_at: number,
  sha1_8: string,
  deviceShort: string,
): string {
  const jstString = new Date(shot_at).toLocaleString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const m = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})/.exec(
    jstString,
  );
  if (!m) {
    throw new Error(`Unexpected JST locale string: ${jstString}`);
  }

  const [, y, month, day, hour, min, sec] = m;
  const YYYYMMDD = `${y}${month!.padStart(2, "0")}${day!.padStart(2, "0")}`;
  const HHmmss = `${hour!.padStart(2, "0")}${min!.padStart(2, "0")}${sec!.padStart(2, "0")}`;

  return `${YYYYMMDD}-${HHmmss}-${deviceShort}-${sha1_8}.jpg`;
}
