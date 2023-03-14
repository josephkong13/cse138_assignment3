const express = require("express");
const gossip = express.Router();
const { merge_kvs } = require("../utils/vc_functions");
const state = require("../state");
const axios = require("axios");
const { full_address } = require("../address");


// broadcast our kvs to everyone in our shard
const broadcast_kvs = function () {

  if(state.shard_number < 1)
    return;

  state.view[state.shard_number - 1].nodes.forEach((address) => {
    if (address != full_address && (!state.partition_testing || state.partition.includes(address))) {
      axios({
        url: `http://${address}/kvs/gossip`,
        method: "put",
        data: {
          kvs: state.kvs,
          total_vc: state.total_vc,
          view_timestamp: state.view_timestamp,
        },
      }).catch((err) => {});
    }
  });
};

// Every 500 ms, broadcast our kvs
function continuous_broadcast() {
  if (state.initialized) {
    broadcast_kvs();
  }

  setTimeout(continuous_broadcast, 500);
}

function reshard_key_distribution(num_shards, sharded_kvs) {
  for (let i = 0; i < num_shards; i++) {
    // send to respective shards
    const ips = state.view[i].nodes;
    ips.forEach((address) => {
      if (address == full_address) return;
  
      axios({
        url: `http://${address}/kvs/gossip`,
        method: "put",
        data: {
          kvs: sharded_kvs[i],
          total_vc: state.total_vc,
          view_timestamp: state.view_timestamp,
        },
      }).catch((err) => {});
    });
  }
}

// PUT endpoint
gossip.put("/", (req, res) => {
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  // if bad body, or sender and receiver have different views, don't merge kvs's
  if (
    !req.body ||
    !req.body.hasOwnProperty("kvs") ||
    !req.body.hasOwnProperty("total_vc") ||
    !req.body.hasOwnProperty("view_timestamp") ||
    req.body.view_timestamp != state.view_timestamp
  ) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  merge_kvs(req.body.total_vc, req.body.kvs);

  res.status(200).send();
});

// GET endpoint
gossip.get("/", (req, res) => {
  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }
  res.status(200).json({ total_vc: state.total_vc, kvs: state.kvs });
});

continuous_broadcast();

module.exports = { gossip, broadcast_kvs, reshard_key_distribution };
