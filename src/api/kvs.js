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

  let { val } = req.body;

  // if val size more than 8MB, send error.
  if (val.length > 8000000) {
    res.status(400).json({ error: "key or val too long" });
    return;
  }

  // no errors, insert the value into the hash map

  // brand new value (no replacing) has specific response
  if (!kvs.has(key)) {
    kvs[key] = val;
    res.status(201).json({ replaced: false });
    return;
  }
  // otherwise, get old value before replacing, then send other response
  else {
    let old_val = kvs[key];
    kvs[key] = val;
    res.status(200).json({ replaced: true, prev: old_val });
    return;
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
