import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderGatewayConf } from "./render-gateway.mjs";
import { parseSanOutput, sanEntry } from "./gen-certs.mjs";

const TEMPLATE = ["server {", "@@HTTP_LISTEN@@", "@@TLS_LISTEN@@", "}"].join("\n");

describe("renderGatewayConf", () => {
  it("renders plain HTTP byte-identically (no gaps)", () => {
    const out = renderGatewayConf(TEMPLATE, {});
    assert.equal(out, ["server {", "    listen 80;", "}"].join("\n"));
  });

  it("adds the 443 listener and drops the 80 listener on redirect", () => {
    const out = renderGatewayConf(TEMPLATE, { TLS_HOSTS: "workbench.lan", TLS_REDIRECT: "1" });
    assert.ok(out.includes("listen 443 ssl;"));
    assert.ok(!out.includes("listen 80;"));
  });
});

describe("sanEntry", () => {
  it("maps IPs to IP entries and names to DNS", () => {
    assert.equal(sanEntry("10.0.0.63"), "IP:10.0.0.63");
    assert.equal(sanEntry("::1"), "IP:::1");
    assert.equal(sanEntry("workbench.lan"), "DNS:workbench.lan");
  });
});

describe("parseSanOutput", () => {
  it("parses openssl subjectAltName output into comparable tokens", () => {
    const tokens = parseSanOutput(
      "X509v3 Subject Alternative Name: \n    DNS:workbench.lan, DNS:localhost, IP Address:127.0.0.1\n",
    );
    assert.deepEqual(tokens, ["DNS:workbench.lan", "DNS:localhost", "IP Address:127.0.0.1"]);
  });
});
