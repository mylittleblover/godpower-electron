"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
function verifyHtml(root) {
  const html = readFileSync(path.join(root, "resources/index.html"));
  const info = JSON.parse(
    readFileSync(path.join(root, "resources/BUILD_INFO.json"), "utf8"),
  );
  if (
    !/^[0-9a-f]{40}$/.test(info.sourceCommit) ||
    info.htmlSha256 !== createHash("sha256").update(html).digest("hex") ||
    info.htmlBytes !== html.length
  )
    throw Error("Bundled classroom HTML integrity check failed");
  for (const [name, sha] of Object.entries(info.sharedAssets || {})) {
    if (name !== "save-schema.js" || !/^[0-9a-f]{64}$/.test(sha) || createHash("sha256").update(readFileSync(path.join(root,"resources",name))).digest("hex") !== sha)
      throw Error("Bundled shared schema integrity check failed");
  }
  return info;
}
function installProtocol(protocol, root) {
  const files = {
    "classroom://app/index.html": [
      "resources/index.html",
      "text/html; charset=utf-8",
      true,
    ],
    "classroom://picker/index.html": [
      "renderer/picker.html",
      "text/html; charset=utf-8",
    ],
    "classroom://picker/picker.js": [
      "renderer/picker.js",
      "text/javascript; charset=utf-8",
    ],
    "classroom://picker/picker.css": [
      "renderer/picker.css",
      "text/css; charset=utf-8",
    ],
    "classroom://effect/index.html": [
      "renderer/effect.html",
      "text/html; charset=utf-8",
    ],
    "classroom://effect/effect.js": [
      "renderer/effect.js",
      "text/javascript; charset=utf-8",
    ],
    "classroom://effect/effect.css": [
      "renderer/effect.css",
      "text/css; charset=utf-8",
    ],
  };
  for (const role of ['picker']) for(const [name,mime] of [['tooltips.js','text/javascript'],['tooltips.css','text/css']]) files[`classroom://${role}/${name}`]=[`renderer/${name}`,mime+'; charset=utf-8'];
  protocol.handle("classroom", (request) => {
    const entry = files[request.url];
    if (request.method !== "GET" || !entry)
      return new Response("Not found", { status: 404 });
    const csp = [
      "default-src 'none'",
      `script-src 'self'${entry[2] ? " 'unsafe-inline'" : ""}`,
      "style-src 'self' 'unsafe-inline' data:",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-src 'none'",
    ].join("; ");
    return new Response(readFileSync(path.join(root, entry[0])), {
      headers: {
        "Content-Type": entry[1],
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  });
}
module.exports = { verifyHtml, installProtocol };
