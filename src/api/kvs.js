const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { address, port } = require("../address");

/* TODO: 
- These routes are old, need to refactor for new spec 
*/

// PUT endpoint
router.put("/:key", (req, res) => {

  const key = req.params.key;

  // if key or val wasn't included in the body, send error

  if (!req.body || !req.body.hasOwnProperty("val")) {
    res.status(400).json({ error: "bad PUT" });
    return;
  }

  let { val, vc } = req.body;

  // if val size more than 8MB, send error.
  if (val.length > 8000000) {
    res.status(400).json({ error: "key or val too long" });
    return;
  }

  // last_written_vc = max of current thc and client, plus 1 for current process
  const last_written_vc = {};

  for(const key in vc)
    last_written_vc[key] = Math.max(vc[key], state.total_vc[key]);

  last_written_vc[address] = last_written_vc[address] + 1;

  // if thc is one behind, increment thc
  // if not dont inc
  // add to ops list

  state.operations_list.push(last_written_vc);

  state.kvs[key] = {
    last_written_vc,
    value: val,
    timestamp: new Date(),
  }

});

// GET endpoint
router.get("/:key", (req, res) => {
  // if key wasn't included in the body, send error
  if (!req.body.hasOwnProperty("key")) {
    res.status(400).json({ error: "bad GET" });
    return;
  }

  let { key } = req.body;
  // if hash map doesn't have the key, send not found error
  if (!(key in kvs)) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // otherwise, send a successful response containing the value of the hash map's value
  else {
    let val = kvs[key];
    res.status(200).json({ val: val });
    return;
  }
});

// DELETE endpoint
router.delete("/", (req, res) => {
  // if key wasn't included in the body, send error
  if (!req.body.hasOwnProperty("key")) {
    res.status(400).json({ error: "bad DELETE" });
    return;
  }

  let { key } = req.body;
  // if hash map doesn't have the key, send not found error
  if (!(kvs in key)) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // otherwise, send a successful response containing the value of the hash map's value
  else {
    let old_val = kvs[key];
    // no errors, delete the hash map's value
    // kvs.delete(key);
    res.status(200).json({ prev: old_val });
    return;
  }
});

module.exports = router;
