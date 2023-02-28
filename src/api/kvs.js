const express = require("express");
const axios = require("axios");
const router = express.Router();
const state = require("../state");
const { full_address } = require("../address");
const { max_vc, compare_vc } = require("../utils/vc_functions");

// add a function for other_stuff too
const broadcast_kvs = function () {
  state.view.forEach((address) => {
      if (address != full_address) {
        axios({
          url: `http://${address}/kvs/gossip`,
          method: "put",
          data: { view: state.view, kvs: state.kvs, total_vc: state.total_vc },
        })
        .catch((err) => {
        });
      }
  })
};

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
  if (!req.body || !req.body.hasOwnProperty("val") || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let val = req.body.val;
  let causal_metadata = req.body["causal-metadata"] ? req.body["causal-metadata"] : {};

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

  // BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW
  broadcast_kvs();

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
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"] ? req.body["causal-metadata"] : {};

  if (state.kvs.hasOwnProperty(key)) {
    let key_last_written = state.kvs[key].last_written_vc;
    // if key_last_written is newer/same/concurrent, return value
    // and causal metadata = max_vc(causal_metadata, key_last_written)
    if (compare_vc(key_last_written, causal_metadata) != "OLDER") {

      const new_causal_metadata = max_vc(causal_metadata, key_last_written);

      // If most recent write of key's value was deleting it
      if (state.kvs[key].value == null) {
        res.status(404).json({ "causal-metadata": new_causal_metadata });
      } else {
        res.status(200).json({
          val: state.kvs[key].value,
          "causal-metadata": new_causal_metadata,
        });
      }

      return;
    }

  }

  // if total_vc is newer or same
  const total_vc_to_causal_metadata = compare_vc(state.total_vc, causal_metadata);
  if (total_vc_to_causal_metadata == "NEWER" || total_vc_to_causal_metadata == "EQUAL") {
    // If key was never written to, send 404 and client's VC back
    if (!state.kvs.hasOwnProperty(key)) {
      res.status(404).json({ "causal-metadata": causal_metadata });
    } else {
      // return value, causal_metadata = max_vc(causal_metadata, key_last_written)
      const key_last_written = state.kvs[key].last_written_vc;
      const new_causal_metadata = max_vc(causal_metadata, key_last_written);

      // If most recent write of key's value was deleting it
      if (state.kvs[key].value == null) {
        res.status(404).json({ "causal-metadata": new_causal_metadata });
      } else {
        res.status(200).json({
          val: state.kvs[key].value,
          "causal-metadata": new_causal_metadata,
        });
      }
    }
    return;
  }

  // TODO: otherwise, if total_vc is concurrent or older

  // stall for 20 secs
  res.status(500).json({ error: "TODO: should stall here" });
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
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"] ? req.body["causal-metadata"] : {};

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

  // BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW
  broadcast_kvs();

  res.status(response_code).json({ "causal-metadata": last_written_vc });
});

// GET endpoint
router.get("/", (req, res) => {
  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"] ? req.body["causal-metadata"] : {};

  // if total_vc is newer or same, we can return our keys
  const total_vc_to_causal_metadata = compare_vc(state.total_vc, causal_metadata);
  console.log(total_vc_to_causal_metadata);
  if (total_vc_to_causal_metadata == "NEWER" || total_vc_to_causal_metadata == "EQUAL") {
    let count = 0;
    const keys = [];

    for (const prop in state.kvs) {
      if (state.kvs[prop].value != null) {
        keys.push(prop);
        count++;
      }
    }

    res.status(200).json({ "causal-metadata": state.total_vc, count, keys });

    return;
  }

  // TODO: otherwise, if total_vc is concurrent or older

  // stall for 20 secs
  res.status(500).json({ error: "TODO: should stall here" });
});

module.exports = router;
