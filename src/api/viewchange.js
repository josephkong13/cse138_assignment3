const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { full_address } = require("../address");
const XXHash = require("xxhash");
const { shard_number } = require("../state");

// This just an example
console.log("HASH: ", XXHash.hash(Buffer.from("balsack"), 0xcafebabe));

// https://www.scaler.com/topics/check-if-object-is-empty-javascript/
function isObjEmpty(obj) {
  return Object.getOwnPropertyNames(obj).length === 0;
}

/* TODO: 
- TODOs are in the routes below
*/

// take a list of nodes and spread them evenly into the shards
function nodes_to_shards(nodes, num_shards) {
  let view = [];

  for (let i = 0; i < num_shards; i++) {
    view.push({ shard_id: `${i + 1}`, nodes: [] });
  }

  let curr_shard = 0;
  nodes.forEach((address) => {
    view[curr_shard].nodes.push(address);
    curr_shard = (curr_shard + 1) % num_shards;
  });

  return view;
}

// View change endpoints
router.put("/", (req, res) => {
  // if view wasn't included in the body, send error
  if (
    !req.body.hasOwnProperty("nodes") ||
    !req.body.hasOwnProperty("num_shards")
  ) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  // If we're the replica getting the initial view change request, set our view_timestamp
  // to the current time
  // the view that the admin requested is now associated with this number.
  if (!req.body.hasOwnProperty("view_timestamp")) {
    state.view_timestamp = Date.now();
  }

  if (req.body.hasOwnProperty("view_timestamp")) {
    // If we've already updated our view to this, our views are the same (or we received an older, stale view). return early.
    if (state.view_timestamp >= req.body.view_timestamp) {
      // console.log("SAME VIEW");
      res.status(200).send();
      return;
    }
    // Otherwise, our view_timestamp becomes the view_timestamp we received
    else {
      state.view_timestamp = req.body.view_timestamp;
    }
  }

  let old_nodes = state.nodes;
  state.nodes = req.body.nodes;

  // If we got some kvs and vc info from the node that is initializing us, update our state.
  if (req.body.hasOwnProperty("kvs") && req.body.hasOwnProperty("view")) {
    state.kvs = req.body.kvs;
    state.view = req.body.view;
  }

  // figure out our shard stuff -- round robin
  if (!req.body.hasOwnProperty("view")) {
    state.view = nodes_to_shards(state.nodes, req.body.num_shards);
  }

  // figure out our shard number

  state.view.forEach((shard) => {
    if (shard.nodes.contains(full_address)) {
      state.shard_number = parseInt(shard.shard_id);
    }
  });

  // reset our total_vc to everyone in our shard, starting at 0 again
  // since state.view is 0-indexed, subtract 1.
  state.view[shard_number - 1].forEach((address) => {
    state.total_vc[address] = 0;
  });

  // reset our kvs last_written_vcs
  for (const key of Object.keys(state.kvs)) {
    state.kvs[key].last_written_vc = {};
  }

  old_nodes.forEach((address) => {
    // Reset any node in the old view that isn't in the new view
    if (!state.view.includes(address)) {
      axios({
        url: `http://${address}/kvs/admin/view`,
        method: "delete",
      }).catch((err) => {});
    }
  });

  // Broadcast endpoint to all replica in the cluster except us
  /* TODO: Reset all last written timers to zero */
  state.nodes.forEach((address) => {
    if (address != full_address) {
      axios({
        url: `http://${address}/kvs/admin/view`,
        method: "put",
        data: {
          nodes: state.nodes,
          view: state.view,
          kvs: state.kvs,
          view_timestamp: state.view_timestamp,
        },
      }).catch((err) => {});
    }
  });

  // TODO: generate hashed_vshards_ordered

  state.initialized = true;

  res.status(200).send();
});

router.get("/", (req, res) => {
  res.status(200).json({ view: state.view });
});

router.delete("/", (req, res) => {
  if (state.initialized) {
    state.initialized = false;
    state.nodes = [];
    state.view = [];
    state.kvs = {};
    state.total_vc = {};
    state.shard_number = 0;
    state.hashed_vshards_ordered = [];

    res.status(200).send();
  }
  // if uninitialized, return error
  else {
    res.status(418).json({ error: "uninitialized" });
  }
});

module.exports = router;
