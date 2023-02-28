const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { full_address } = require("../address");

// https://www.scaler.com/topics/check-if-object-is-empty-javascript/
function isObjEmpty (obj) {
  return Object.getOwnPropertyNames(obj).length === 0;
}

/* TODO: 
- TODOs are in the routes below
*/

// View change endpoints
router.put("/", (req, res) => { 
  // if view wasn't included in the body, send error
  if (!req.body.hasOwnProperty("view")) {
    res.status(400).json({ error: "bad request" });
    return;
  }
  
  let old_view = state.view;
  state.view = req.body.view;

  let reset = false;

  // If we got some kvs and vc info from the node that is initializing us, update our state.
  if (req.body.hasOwnProperty("kvs") && req.body.hasOwnProperty("total_vc")) {
    state.kvs = req.body.kvs;
    state.total_vc = req.body.total_vc;
  }

  // If we still have an empty_vc, we are the first node of a brand new view
  // Initialize it to 0s for all addresses
  if (isObjEmpty(state.total_vc)) {
    state.view.forEach((address) => {
      state.total_vc[address] = 0;
    })
  }
  
  old_view.forEach((address) => {
    // Reset any node in the old view that isn't in the new view
    if (!state.view.includes(address)) {
      axios({
        url: `http://${address}/kvs/admin/view`,
        method: "put",
        headers: { "X-HTTP-Method-Override": "DELETE" },
      }).catch((err) => {
        // if server responded with an error, forward it to requester
        if (err.response) {
          res.status(err.response.status).json(err.response.data);
        }
      });
      reset = true;
    }
  });
  
  // If we didn't reset anything and old_view has the same length as the new view
  // then the views are the same
  // if views are the same, just return
  if (reset == false && old_view.length == state.view.length) {
    // console.log("SAME VIEW");
    res.status(200).send();
    return;
  }

  // Broadcast endpoint to all replica in the cluster except us
  state.view.forEach((address) => {
    if (address != full_address) {
      axios({
        url: `http://${address}/kvs/admin/view`,
        method: "put",
        data: { view: state.view, kvs: state.kvs, total_vc: state.total_vc },
      }).catch((err) => {
        // if server responded with an error, forward it to requester
        if (err.response) {
          res.status(err.response.status).json(err.response.data);
        }
      });
    }
  });

  state.initialized = true;

  // console.log('view', state.view);
  // console.log('total_vc', state.total_vc);

  res.status(200).send();
});

router.get("/", (req, res) => {
  res.status(200).json({ view: state.view });
});

router.delete("/", (req, res) => {
  if (state.initialized) {
    state.initialized = false;
    state.view = [];
    state.kvs = {};
    state.total_vc = {};

    res.status(200).send();
  }
  // if uninitialized, return error
  else {
    res.status(418).json({ error: "uninitialized" });
  }
});

module.exports = router;
