import { idbGet, idbPut } from "@/app/lib/idb";

const CONFIG_STORE = "config";
const AUTO_AI_RENAME_KEY = "auto_ai_rename_enabled";

type ConfigItem<T> = {
  key: string;
  value: T;
};

export async function getAutoAiRenameEnabled(): Promise<boolean> {
  try {
    const config = await idbGet<ConfigItem<boolean>>(
      CONFIG_STORE,
      AUTO_AI_RENAME_KEY,
    );
    return config?.value ?? true;
  } catch (error) {
    console.error("Error getting auto AI rename state from IDB:", error);
    return true;
  }
}

export async function setAutoAiRenameEnabled(enabled: boolean): Promise<void> {
  try {
    await idbPut<ConfigItem<boolean>>(CONFIG_STORE, {
      key: AUTO_AI_RENAME_KEY,
      value: enabled,
    });
  } catch (error) {
    console.error("Error setting auto AI rename state in IDB:", error);
  }
}
