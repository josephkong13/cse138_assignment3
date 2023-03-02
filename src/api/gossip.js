const express = require("express");
const gossip = express.Router();
const { merge_kvs } = require("../utils/vc_functions");
const state = require("../state");
const axios = require("axios");
const { full_address } = require("../address");

// add a function for other_stuff too
const broadcast_kvs = function () {
  state.view.forEach((address) => {
    if (address != full_address && (!state.partition_testing || state.partition.includes(address))) {
      axios({
        url: `http://${address}/kvs/gossip`,
        method: "put",
        data: { kvs: state.kvs, total_vc: state.total_vc },
      });
    }
  });
};

// Every 5 seconds, broadcast our kvs
function continuous_broadcast() {
  if (state.initialized) {
    broadcast_kvs();
  }

  setTimeout(continuous_broadcast, 5000);
}

// PUT endpoint
gossip.put("/", (req, res) => {
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  if (
    !req.body ||
    !req.body.hasOwnProperty("kvs") ||
    !req.body.hasOwnProperty("total_vc")
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

module.exports = { gossip, broadcast_kvs };
