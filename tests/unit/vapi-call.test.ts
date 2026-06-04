import assert from "node:assert/strict";
import test from "node:test";

import { extractVapiErrorMessage, isVapiBenignEnd } from "@/components/talkt/use-vapi-call";

test("extractVapiErrorMessage reads nested Daily/Vapi error messages", () => {
  const raw = {
    error: {
      errorMsg: "Meeting has ended",
      message: {
        msg: "Exiting meeting because room was deleted",
        type: "no-room",
      },
    },
    type: "daily-error",
  };

  assert.equal(extractVapiErrorMessage(raw), "Meeting has ended");
});

test("isVapiBenignEnd treats room deletion meeting end as normal teardown", () => {
  assert.equal(isVapiBenignEnd("Meeting has ended"), true);
});

test("isVapiBenignEnd treats deleted Daily rooms as normal teardown", () => {
  assert.equal(isVapiBenignEnd("Exiting meeting because room was deleted"), true);
});
