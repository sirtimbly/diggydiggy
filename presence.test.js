import test from "node:test";
import assert from "node:assert/strict";
import { collaborators, guestCreature, guestName, initials, presenceColor } from "./src/sync/presence.js";
import { UNDERGROUND_CREATURES } from "./src/sync/creatures.js";
import { CREATURE_SPRITES } from "./src/rendering/creatures.js";

test("every anonymous identity has a matching underground creature sprite and stays paired across reconnects", () => {
  const assigned = new Set();
  for (let index = 0; index < 500; index++) {
    const session = `browser-${index}`, creature = guestCreature(session);
    assert.equal(guestName(session), `Anonymous ${creature.name}`);
    assert.equal(guestCreature(session).id, creature.id);
    assert.ok(CREATURE_SPRITES[creature.id]);
    assigned.add(creature.id);
  }
  assert.equal(assigned.size, 12);
  assert.deepEqual([...assigned].sort(), UNDERGROUND_CREATURES.map((creature) => creature.id).sort());
});

test("the roster groups a signed-in person's tabs and keeps anonymous sessions separate", () => {
  const peers = [
    { id: "tab1", personId: "alex", name: "Alex", active: false },
    { id: "tab2", personId: "alex", name: "Alex", active: true },
    { id: "guest1", personId: "guest:1", name: "Anonymous Mole", active: true },
    { id: "guest2", personId: "guest:2", name: "Anonymous Mole", active: true },
  ];
  const roster = collaborators(peers, "tab2");
  assert.equal(roster.length, 3);
  assert.deepEqual({ tabs: roster[0].tabs, self: roster[0].self, active: roster[0].active }, { tabs: 2, self: true, active: true });
  assert.equal(peers[0].active, false);
  assert.equal(initials("  Alex Digger  "), "AD");
  assert.match(guestName("session"), /^Anonymous /);
  assert.equal(presenceColor("session"), presenceColor("session"));
});
