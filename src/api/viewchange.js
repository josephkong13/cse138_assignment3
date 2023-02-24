const express = require("express");
const router = express.Router();
const state = require("../state");
const axios = require("axios");
const { address, port } = require("./address");

/* TODO: 
- TODOs are in the routes below
*/

// View change endpoints
router.put("/", (req, res) => {
  // if view wasn't included in the body, send error
  if (!req.body.hasOwnProperty("view")) {
    res.status(400).json({ error: "bad PUT" });
    return;
  }

  // TODO: if views are the same (maybe do some set comparison?), just return

  let old_view = state.view;
  state.view = req.body.view;

  old_view.forEach((address) => {
    // Reset any node in the old view that isn't in the new view
    if (!state.view.includes(address)) {
      axios({
        url: `http://${address}/kvs/admin/view`,
        method: "put",
        data: { view: state.view },
        headers: { "X-HTTP-Method-Override": "DELETE" },
      }).catch((err) => {
        // if server responded with an error, forward it to requester
        if (err.response) {
          res.status(err.response.status).json(err.response.data);
        }
      });
    }
  });

  state.view.forEach((address) => {
    axios({
      url: `http://${address}/kvs/admin/view`,
      method: "put",
      data: { view: state.view, kvs: state.kvs },
    }).catch((err) => {
      // if server responded with an error, forward it to requester
      if (err.response) {
        res.status(err.response.status).json(err.response.data);
      }
    });
  });

  state.initialized = true;
});

router.get("/", (req, res) => {
  res.status(200).json({ view: state.view });
});

router.delete("/", (req, res) => {
  if (state.initialized) {
    state.initialized = false;
    state.view = [];
    state.kvs = {};

    res.status(200);
  }
  // if uninitialized, return error
  else {
    res.status(418).json({ error: "uninitialized" });
  }
});

module.exports = router;
