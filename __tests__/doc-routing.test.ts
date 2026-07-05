import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocRouting } from "../app/lib/doc-routing";
import * as IdbHelpers from "../app/lib/idb-helpers";
import { ensureRoutingFolder, findDriveRoutingFolder } from "../app/lib/doc-routing";

vi.mock("../app/lib/idb-helpers", () => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(),
}));

const mockIdbGet = vi.mocked(IdbHelpers.idbGet);
const mockIdbPut = vi.mocked(IdbHelpers.idbPut);

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response;
}

function readFetchBody(callIndex: number): Record<string, unknown> {
  const init = vi.mocked(fetch).mock.calls[callIndex]?.[1] as RequestInit;
  expect(typeof init.body).toBe("string");
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("doc-routing auto-provision", () => {
  let routing: DocRouting;

  beforeEach(() => {
    routing = {};
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    mockIdbGet.mockImplementation(async () => ({
      key: "doc_routing",
      value: routing,
    }));
    mockIdbPut.mockImplementation(async (_store, record) => {
      routing = (record as { value: DocRouting }).value;
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates, tags, registers, and returns a missing routing folder", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "folder-receipt", name: "領収書" }));

    const target = await ensureRoutingFolder({
      doc_type: "receipt",
      parent_id: "main-folder",
      accessToken: "token",
    });

    expect(target).toBe("folder-receipt");
    expect(routing).toEqual({ receipt: "folder-receipt" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      "https://www.googleapis.com/drive/v3/files?",
    );
    const createBody = readFetchBody(1);
    expect(createBody).toMatchObject({
      name: "領収書",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["main-folder"],
      appProperties: { cursorversDocType: "receipt" },
    });
    expect(mockIdbPut).toHaveBeenCalledWith("config", {
      key: "doc_routing",
      value: { receipt: "folder-receipt" },
    });
  });

  it("reuses and registers an existing Drive folder before creating one", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        files: [
          {
            id: "folder-existing",
            name: "名刺",
            appProperties: { cursorversDocType: "business_card" },
          },
        ],
      }),
    );

    const target = await ensureRoutingFolder({
      doc_type: "business_card",
      parent_id: "main-folder",
      accessToken: "token",
    });

    expect(target).toBe("folder-existing");
    expect(routing).toEqual({ business_card: "folder-existing" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent provisioning for the same doc_type", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "folder-memo", name: "メモ" }));

    const [first, second] = await Promise.all([
      ensureRoutingFolder({
        doc_type: "memo",
        parent_id: "main-folder",
        accessToken: "token",
      }),
      ensureRoutingFolder({
        doc_type: "memo",
        parent_id: "main-folder",
        accessToken: "token",
      }),
    ]);

    expect(first).toBe("folder-memo");
    expect(second).toBe("folder-memo");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readFetchBody(1)).toMatchObject({
      name: "メモ",
      appProperties: { cursorversDocType: "memo" },
    });
    expect(mockIdbPut).toHaveBeenCalledTimes(1);
  });

  it("builds the Drive search around parent, label, and appProperties", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ files: [] }));

    await findDriveRoutingFolder({
      doc_type: "other",
      parent_id: "main-folder",
      accessToken: "token",
    });

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    const q = url.searchParams.get("q") ?? "";
    expect(q).toContain("'main-folder' in parents");
    expect(q).toContain("name = 'その他'");
    expect(q).toContain(
      "appProperties has { key='cursorversDocType' and value='other' }",
    );
  });
});
