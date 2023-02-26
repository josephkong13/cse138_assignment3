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
    res.status(400).json({ error: "bad PUT" });
    return;
  }

  let val = req.body.val;
  let causal_metadata = req.body["causal-metadata"];

  // if val size more than 8MB, send error. may have to consider js objects
  if (val.length > 8000000) {
    res.status(400).json({ error: "key or val too long" });
    return;
  }

  // last_written_vc = max of current thc and client, plus 1 for current write
  if (state.total_vc.hasOwnProperty(full_address)) {
    state.total_vc[full_address] += 1; 
  } else {
    state.total_vc[full_address] = 1; 
  }

  const last_written_vc = max_vc(causal_metadata, state.total_vc);

  state.kvs[key] = {
    last_written_vc,
    value: val,
    timestamp: Date.now(),
  }

  // TODO: BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW

  res.status(200).json({ "causal-metadata": last_written_vc });

  // console.log(last_written_vc);

  // for(const ip in state.total_vc) {
  //   const causal_ip_val = causal_metadata[ip] ? causal_metadata[ip] : 0;
  //   last_written_vc[ip] = Math.max(causal_ip_val, state.total_vc[ip]);
  // }

  // last_written_vc[address] = last_written_vc[address] + 1;

  // // if thc is one behind, increment thc
  // // if not dont inc
  // // add to ops list

  // // last_written_vc is always going to be newer than the total_vc
  // let difference = 0;
  // for(const ip in state.total_vc) {
  //   difference = difference + last_written_vc[ip] - state.total_vc[ip]; 
  // }

  // if(difference == 1) {
  //   state.total_vc
  // }

  // state.operations_list.push(last_written_vc);

  // state.kvs[key] = {
  //   last_written_vc,
  //   value: val,
  //   timestamp: new Date(),
  // }

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
