const express = require("express");
const router = express.Router();
const { merge_kvs } = require("../utils/vc_functions");

// PUT endpoint
router.put("/", (req, res) => {
  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body.hasOwnProperty("kvs") || !req.body.hasOwnProperty("total_vc")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  merge_kvs(req.body.total_vc, req.body.kvs);

  res.status(200).send();
});

// GET endpoint
router.get("/", (req, res) => {
  res.status(200).send();
});

module.exports = router;