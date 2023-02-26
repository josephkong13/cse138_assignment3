const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { full_address } = require("../address");
const { max_vc } = require("../utils/vc_functions");

// add a function for other_stuff too

/* TODO: 
- These routes are old, need to refactor for new spec 
*/

// PUT endpoint
router.put("/:key", (req, res) => {

  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  const key = req.params.key;

  // if causal_metadata or val wasn't included in the body, send error
  if (!req.body || !req.body.val || !req.body["causal-metadata"]) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let val = req.body.val;
  let causal_metadata = req.body["causal-metadata"];

  // if val size more than 8MB, send error. may have to consider js objects
  if (val.length > 8000000) {
    res.status(400).json({ error: "val too large" });
    return;
  }

  // last_written_vc = max of current thc and client, plus 1 for current write
  if (state.total_vc.hasOwnProperty(full_address)) {
    state.total_vc[full_address] += 1; 
  } else {
    state.total_vc[full_address] = 1; 
  }

  const last_written_vc = max_vc(causal_metadata, state.total_vc);

  // If the key we write to was deleted or completely new, use response code 201
  let response_code = 201;

  // If we had an existing, non-deleted value, use response code 200
  if (state.kvs.hasOwnProperty(key) && state.kvs[key] != null) {
    response_code = 200;
  }

  state.kvs[key] = {
    last_written_vc,
    value: val,
    timestamp: Date.now(),
  }

  // TODO: BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW

  res.status(response_code).json({ "causal-metadata": last_written_vc });
});

// GET endpoint
router.get("/:key", (req, res) => {
  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  const key = req.params.key;

  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body["causal-metadata"]) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"];

  if (kvs.hasOwnProperty(key)) {
    let key_last_written = kvs[key].last_written_vc;
    // compare_vc(key_last_written, causal_metadata);

    // if key_last_written is newer/same/concurrent, return value
    // and causal metadata = max_vc(causal_metadata, key_last_written)

  }

  // compare_vc(state.total_vc, kvs[key].last_written_vc);

  // if total_vc is newer or same
  // return value, causal_metadata = max_vc(causal_metadata, key_last_written)

  // otherwise, if total_vc is concurrent or older

  // // if hash map doesn't have the key, send not found error
  // if (!(key in kvs)) {
  //   res.status(404).json({ error: "not found" });
  //   return;
  // }
  // // otherwise, send a successful response containing the value of the hash map's value
  // else {
  //   let val = kvs[key];
  //   res.status(200).json({ val: val });
  //   return;
  // }
});

// DELETE endpoint
router.delete("/:key", (req, res) => {

  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  const key = req.params.key;

  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body["causal-metadata"]) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"];

  // last_written_vc = max of current thc and client, plus 1 for current write
  if (state.total_vc.hasOwnProperty(full_address)) {
    state.total_vc[full_address] += 1; 
  } else {
    state.total_vc[full_address] = 1; 
  }

  const last_written_vc = max_vc(causal_metadata, state.total_vc);

  // If the key we write to was deleted or doesn't exist, use response code 404
  let response_code = 404;

  // If we had an existing, non-deleted value, use response code 200
  if (state.kvs.hasOwnProperty(key) && state.kvs[key] != null) {
    response_code = 200;
  }

  state.kvs[key] = {
    last_written_vc,
    value: null,
    timestamp: Date.now(),
  }

  // TODO: BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW

  res.status(response_code).json({ "causal-metadata": last_written_vc });
});

module.exports = router;
