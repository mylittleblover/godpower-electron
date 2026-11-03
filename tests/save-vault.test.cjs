const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const { SaveVault } = require("../desktop/save-vault.cjs");
const hash = (text) => createHash("sha256").update(text).digest("hex");
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gp-vault-"));
  const context = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(
      path.join(
        process.env.GODPOWER_HTML_REPO || "../godpower-html-latest",
        "src/domain/save-document.js",
      ),
      "utf8",
    ),
    context,
  );
  return {
    root,
    vault: new SaveVault({ root, schema: context.SaveSchema }),
    schema: context.SaveSchema,
  };
}
function preview(score = 10) {
  const sourceText = JSON.stringify({ schemaVersion: 2, groups: [{ score }] });
  const sourceDigest = hash(sourceText);
  return {
    sourceText,
    sourceDigest,
    assets: [],
    documents: [
      {
        kind: "godpower.save",
        schemaVersion: 2,
        saveId: "save-" + sourceDigest,
        revision: 1,
        name: "测试课堂",
        createdAt: "2026-11-03",
        updatedAt: "2026-11-03",
        roster: {
          revision: 1,
          students: [],
          groups: [{ groupUid: "group-test", name: "小组" }],
          assignments: [],
        },
        archives: [],
        achievements: { schemaVersion: 1, groups: {} },
        perSaveOptions: {},
        match: {
          season: { seasonId: "season-test" },
          round: {},
          picker: {},
          itemGlobal: {},
          groups: [
            { groupUid: "group-test", score, members: [], inventory: [] },
          ],
          history: [],
        },
        assetReferences: [],
      },
    ],
  };
}
async function cleanup(w) {
  await w.vault.whenIdle();
  fs.rmSync(w.root, { recursive: true, force: true });
}
test("native import preserves original bytes, deduplicates retries and survives reopen", async () => {
  const w = setup();
  try {
    const p = preview();
    assert.equal((await w.vault.importPreview(p, { activate: true })).ok, true);
    assert.equal((await w.vault.importPreview(p)).idempotent, true);
    const list = await w.vault.list();
    assert.equal(list.index.entries.length, 1);
    assert.equal(
      (await w.vault.getSource(p.sourceDigest)).sourceText,
      p.sourceText,
    );
    const reopened = new SaveVault({ root: w.root, schema: w.schema });
    assert.equal(
      (await reopened.load(p.documents[0].saveId)).document.match.groups[0]
        .score,
      10,
    );
  } finally {
    await cleanup(w);
  }
});
test("native commit acknowledges serialized revisions and rejects late save generations", async () => {
  const w = setup();
  try {
    const a = preview(),
      b = preview(99);
    await w.vault.importPreview(a, { activate: true });
    const { index } = await w.vault.list();
    const doc = a.documents[0];
    doc.match.groups[0].score = 12;
    const results = await Promise.all([
      w.vault.commit(doc.saveId, 1, doc, {
        expectedGeneration: index.generation,
      }),
      w.vault.commit(doc.saveId, 1, doc, {
        expectedGeneration: index.generation,
      }),
    ]);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].code, "REVISION_CONFLICT");
    await w.vault.importPreview(b);
    assert.equal(
      (
        await w.vault.switchActive(b.documents[0].saveId, {
          expectedGeneration: index.generation,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await w.vault.commit(doc.saveId, 2, results[0].document, {
          expectedGeneration: index.generation,
        })
      ).code,
      "GENERATION_CONFLICT",
    );
    assert.equal(
      (await w.vault.load(doc.saveId)).document.match.groups[0].score,
      12,
    );
  } finally {
    await cleanup(w);
  }
});
test("index publication failure leaves the old document authoritative and does not register imported sources", async () => {
  const w = setup();
  let rename;
  try {
    const p = preview();
    await w.vault.importPreview(p, { activate: true });
    const doc = p.documents[0];
    doc.match.groups[0].score = 33;
    rename = fs.promises.rename;
    fs.promises.rename = async (a, b) => {
      if (b === path.join(w.root, "index.json"))
        throw Object.assign(Error("disk failed"), { code: "EIO" });
      return rename(a, b);
    };
    assert.equal((await w.vault.commit(doc.saveId, 1, doc)).ok, false);
    assert.equal((await w.vault.importPreview(preview(999))).ok, false);
    fs.promises.rename = rename;
    rename = null;
    assert.equal(
      (await w.vault.load(doc.saveId)).document.match.groups[0].score,
      10,
    );
    assert.equal((await w.vault.list()).index.entries.length, 1);
    assert.equal(await w.vault.getSource(preview(999).sourceDigest), null);
  } finally {
    if (rename) fs.promises.rename = rename;
    await cleanup(w);
  }
});
test("native vault rejects path traversal, missing assets and tampered data without changing the index", async () => {
  const w = setup();
  try {
    const p = preview();
    p.documents[0].saveId = "save-../../outside";
    assert.equal((await w.vault.importPreview(p)).ok, false);
    assert.equal((await w.vault.list()).index.entries.length, 0);
    const q = preview();
    q.sourceText += " ";
    assert.equal(
      (await w.vault.importPreview(q)).code,
      "SOURCE_DIGEST_MISMATCH",
    );
    const r = preview();
    r.documents[0].assetReferences = ["asset-" + "a".repeat(64)];
    assert.equal((await w.vault.importPreview(r)).code, "MISSING_ASSET");
    assert.equal((await w.vault.list()).index.entries.length, 0);
  } finally {
    await cleanup(w);
  }
});
test("global preferences persist separately and enforce compare-and-swap", async () => {
  const w = setup();
  try {
    assert.equal(
      (
        await w.vault.savePreferences(
          { theme: "marx" },
          { expectedRevision: 0 },
        )
      ).ok,
      true,
    );
    assert.equal(
      (await w.vault.savePreferences({ theme: "bad" }, { expectedRevision: 0 }))
        .code,
      "REVISION_CONFLICT",
    );
    assert.equal(
      (await w.vault.loadPreferences()).preferences.values.theme,
      "marx",
    );
    assert.equal((await w.vault.list()).index.entries.length, 0);
  } finally {
    await cleanup(w);
  }
});

test("save-vault dispatch rejects arbitrary methods and incorrect argument counts", async () => {
  const { dispatch } = require("../desktop/save-vault-bridge.cjs");
  let called = 0;
  const service = {
    list: () => {
      called++;
      return { ok: true };
    },
  };
  for (const action of [
    "constructor",
    "__proto__",
    "atomicWrite",
    "readIndex",
    "close",
    "enqueue",
  ])
    assert.equal(
      (await dispatch(service, action, [])).code,
      "INVALID_SAVE_ACTION",
    );
  assert.equal(
    (await dispatch(service, "list", ["ignored"])).code,
    "INVALID_SAVE_ACTION",
  );
  assert.equal(called, 0);
  assert.equal((await dispatch(service, "list", [])).ok, true);
  assert.equal(called, 1);
});
test("only the main preload exposes the bounded save vault API", () => {
  const source = fs.readFileSync(path.resolve("preload/desktop.cjs"), "utf8");
  for (const role of ["main", "picker", "effect"]) {
    let bridge;
    const calls = [];
    vm.runInNewContext(source, {
      process: { argv: ["electron", "--gp-role=" + role] },
      require: () => ({
        contextBridge: {
          exposeInMainWorld: (_name, value) => (bridge = value),
        },
        ipcRenderer: { on() {}, invoke: (...args) => calls.push(args) },
      }),
    });
    if (role === "main") {
      bridge.saveVault.load("save-test");
      assert.equal(calls[0][0], "gp:save-vault");
      assert.equal(calls[0][1], "load");
      assert.equal(JSON.stringify(calls[0][2]), '["save-test"]');
      assert.equal(bridge.saveVault.atomicWrite, undefined);
    } else assert.equal(bridge.saveVault, undefined);
  }
});

test("equal avatar bytes are shared across imported saves regardless of metadata key order", async () => {
  const w = setup();
  try {
    const bytes = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
      sha256 = hash(bytes),
      resourceId = "asset-" + sha256;
    const first = preview();
    first.assets = [
      {
        resourceId,
        sha256,
        mimeType: "image/png",
        dataBase64: bytes.toString("base64"),
        byteLength: bytes.length,
      },
    ];
    first.documents[0].assetReferences = [resourceId];
    assert.equal((await w.vault.importPreview(first)).ok, true);
    const second = preview(31);
    second.assets = [
      {
        resourceId,
        mimeType: "image/png",
        sha256,
        byteLength: bytes.length,
        dataBase64: bytes.toString("base64"),
      },
    ];
    second.documents[0].assetReferences = [resourceId];
    assert.equal((await w.vault.importPreview(second)).ok, true);
    assert.equal((await w.vault.list()).index.entries.length, 2);
  } finally {
    await cleanup(w);
  }
});
