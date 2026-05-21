// Google Picker API ラッパー。
// drive.file + drive.metadata.readonly scope の access_token を使い、
// Drive と同じ UI のフォルダ選択モーダルを表示する。

interface DocsViewInstance {
  setSelectFolderEnabled(enabled: boolean): DocsViewInstance;
  setIncludeFolders(include: boolean): DocsViewInstance;
  setMimeTypes(mime: string): DocsViewInstance;
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface PickerBuilderInstance {
  addView(view: DocsViewInstance): PickerBuilderInstance;
  enableFeature(feature: string): PickerBuilderInstance;
  setOAuthToken(token: string): PickerBuilderInstance;
  setOrigin(origin: string): PickerBuilderInstance;
  setTitle(title: string): PickerBuilderInstance;
  setAppId(appId: string): PickerBuilderInstance;
  setDeveloperKey(key: string): PickerBuilderInstance;
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilderInstance;
  build(): PickerInstance;
}

interface PickerCallbackData {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string }>;
}

interface PickerNamespace {
  Action: { PICKED: string; CANCEL: string };
  Feature: { SUPPORT_DRIVES: string; MINE_ONLY: string };
  ViewId: { FOLDERS: string; DOCS: string };
  DocsView: new (viewId?: string) => DocsViewInstance;
  PickerBuilder: new () => PickerBuilderInstance;
}

interface GapiNamespace {
  load: (lib: string, opts: { callback: () => void }) => void;
}

// Type-safe access without redeclaring Window.google (gis.ts already declares it)
function getGapi(): GapiNamespace | undefined {
  return (window as unknown as { gapi?: GapiNamespace }).gapi;
}

function getPicker(): PickerNamespace | undefined {
  const w = window as unknown as { google?: { picker?: PickerNamespace } };
  return w.google?.picker;
}

/**
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID は
 *   "{project_number}-{random}.apps.googleusercontent.com"
 * 形式。先頭の数字部分 (= Google Cloud project number) を返す。
 * これが Picker の AppId として使える。
 */
function getProjectNumber(): string | null {
  const cid = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!cid) return null;
  const m = cid.match(/^(\d+)-/);
  return m ? m[1] : null;
}

const PICKER_API_URL = "https://apis.google.com/js/api.js";

let scriptPromise: Promise<void> | null = null;
let pickerLibPromise: Promise<void> | null = null;

async function loadPickerScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (getGapi()) return;
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const selector = 'script[src="' + PICKER_API_URL + '"]';
    const existing = document.querySelector(selector);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("picker script load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = PICKER_API_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("picker script load failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function loadPickerLib(): Promise<void> {
  await loadPickerScript();
  if (getPicker()) return;
  if (pickerLibPromise) return pickerLibPromise;
  pickerLibPromise = new Promise<void>((resolve, reject) => {
    const gapi = getGapi();
    if (!gapi) {
      reject(new Error("gapi not loaded"));
      return;
    }
    // 10s タイムアウトで永久 hang を防ぐ
    const timer = window.setTimeout(() => {
      reject(new Error("gapi.load(picker) timeout (10s)"));
    }, 10_000);
    gapi.load("picker", {
      callback: () => {
        window.clearTimeout(timer);
        resolve();
      },
    });
  });
  return pickerLibPromise;
}

export type PickedFolder = { id: string; name: string };

export async function pickFolder(accessToken: string): Promise<PickedFolder | null> {
  if (typeof window === "undefined") return null;
  await loadPickerLib();
  const g = getPicker();
  if (!g) throw new Error("Google Picker library failed to load");

  return new Promise<PickedFolder | null>((resolve, reject) => {
    try {
      const view = new g.DocsView(g.ViewId.FOLDERS);
      view.setSelectFolderEnabled(true);
      view.setIncludeFolders(true);
      view.setMimeTypes("application/vnd.google-apps.folder");

      const appId = getProjectNumber();
      let builder = new g.PickerBuilder()
        .addView(view)
        .enableFeature(g.Feature.SUPPORT_DRIVES)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setTitle("保存先フォルダを選択");
      if (appId) {
        builder = builder.setAppId(appId);
      }
      const picker = builder
        .setCallback((data) => {
          if (data.action === g.Action.PICKED) {
            const folder = data.docs?.[0];
            if (folder?.id && folder?.name) {
              resolve({ id: folder.id, name: folder.name });
            } else if (folder?.id) {
              resolve({ id: folder.id, name: "(名前不明)" });
            } else {
              resolve(null);
            }
          } else if (data.action === g.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });
}
