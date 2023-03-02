const express = require("express");
const router = express.Router();
const state = require("../state");

// View change endpoints
router.put("/", (req, res) => { 
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  // if view wasn't included in the body, send error
  if (!req.body.hasOwnProperty("partition")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  state.partition = req.body.partition;
  state.partition_testing = true;

  res.status(200).send();
});

// View change endpoints
router.delete("/", (req, res) => { 
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }

  state.partition = [];
  state.partition_testing = false;

  res.status(200).send();
});


module.exports = router;
