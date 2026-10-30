import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedActorId } from "./request-identity.ts";

test("uses the authenticated Sites identity for hosted mutations", () => {
  const request = new Request("https://ouro-fino.example/api/reviews", { headers: { "oai-authenticated-user-id": "user-1" } });
  assert.equal(authenticatedActorId(request), "user-1");
});

test("allows the preview identity only on loopback hosts", () => {
  assert.equal(authenticatedActorId(new Request("http://localhost:8787/api/imports")), "local-preview");
  assert.equal(authenticatedActorId(new Request("http://127.0.0.1:8787/api/imports")), "local-preview");
  assert.equal(authenticatedActorId(new Request("https://ouro-fino.example/api/imports")), null);
});
