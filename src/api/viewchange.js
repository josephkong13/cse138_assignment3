const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { address, port } = require("../address");

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
  if(req.body.kvs){
    state.kvs = req.body.kvs;
  }
  if(req.body.total_vc){
    state.total_vc = req.body.total_vc;
  }
  
  let old_view = state.view;
  state.view = req.body.view;
  let reset = false;
  
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
  //  if views are the same, just return
  if(reset == false && old_view.length == state.view.length){
    console.log("SAME VIEW");
    res.status(200).send();
    return;
  }
  state.view.forEach((address) => {
    // send view, kvs, and total clock to nodes in the new view
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
  });

  state.initialized = true;
  res.status(200).send();
  return;
});

router.get("/", (req, res) => {
  res.status(200).json({ view: state.view });
});

router.delete("/", (req, res) => {
  if (state.initialized) {
    state.initialized = false;
    state.view = [];
    state.kvs = {};
    state.total_vc = [];

    res.status(200).send();
  }
  // if uninitialized, return error
  else {
    res.status(418).json({ error: "uninitialized" });
  }
});

module.exports = router;
