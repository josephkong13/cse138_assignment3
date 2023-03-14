const express = require("express");
const router = express.Router();
const state = require("../state");
const { full_address } = require("../address");
const {
  max_vc,
  compare_vc_all_nodes,
  compare_vc_shard,
} = require("../utils/vc_functions");
const { hash, hash_search } = require("../utils/shard_functions");
const { broadcast_kvs } = require("./gossip");
const axios = require("axios");

function causal_metadata_setup(causal_metadata) {
  let client_view_timestamp = causal_metadata.hasOwnProperty("view_timestamp")
    ? causal_metadata.view_timestamp
    : 0;
  let client_vc = causal_metadata.hasOwnProperty("vc")
    ? causal_metadata.vc
    : {};

  // reset client's causal_metadata_vc if our replica has a newer view.
  if (state.view_timestamp > client_view_timestamp) {
    client_vc = {};
  }

  return client_vc;
}

const uninitialized_check = (req, res, next) => {
  // if we're uninitialized, return 418
  if (!state.initialized) {
    res.status(418).json({ error: "uninitialized" });
    return;
  }
  next();
};

const shard_check = async (req, res, next) => {
  const key = req.params.key;
  const hashed_key = hash(key);
  const [_, shard_num] = hash_search(state.hashed_vshards_ordered, hashed_key);
  // if our shard is not responsible for this key, forward it to all the IPs in the shard actually responsible.
  if (shard_num != state.shard_number) {
    // We must stall and forward the request to the IPs that have this shard_num
    const shard_nodes = state.view[shard_num - 1].nodes;
    // either, delete, put or get
    const method = req.method;

    let responded = false;

    // every 5 seconds, forward the request to all IPs in the shard
    // return the first response we get back from the shard
    // try this 4 times, for a total of 20 seconds
    for (let i = 0; i < 4; i++) {
      if (!responded) {

        // generate requests every time
        // Promise.race() cannot re-use the same array more than once
        const requests = shard_nodes.map((ip) =>
          axios({
            url: `http://${ip}/kvs/data/${key}`,
            method: "put",
            data: req.body,
            timeout: 5000, // 5 seconds
            headers: { "X-HTTP-Method-Override": method },
          })
        );

        await Promise.race(requests)
        .then((upstream_res) => {
          res.status(upstream_res.status).json(upstream_res.data);
          responded = true;
        })
        .catch((err) => {
          // if server responded with an error, forward it to client
          if (err.response) {
            res.status(err.response.status).json(err.response.data);
            responded = true;
          }
        });
      }
    }

    // if all the forwarding attempts failed, return 503.
    if (!responded) {
      res.status(503).json({
        error: "upstream down",
        upstream: {
          shard_id: `${shard_num}`,
          nodes: state.view[shard_num - 1].nodes
        }
      });
    }
    return;
  }
  next();
};

// PUT endpoint
router.put("/:key", uninitialized_check, shard_check, (req, res) => {
  const key = req.params.key;

  // if causal_metadata or val wasn't included in the body, send error
  if (
    !req.body ||
    !req.body.hasOwnProperty("val") ||
    !req.body.hasOwnProperty("causal-metadata")
  ) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let val = req.body.val;
  let causal_metadata = req.body["causal-metadata"]
    ? req.body["causal-metadata"]
    : {};

  let client_vc = causal_metadata_setup(causal_metadata);

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

  const last_written_vc = max_vc(client_vc, state.total_vc);

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
  };

  // BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW
  broadcast_kvs();

  res.status(response_code).json({
    "causal-metadata": {
      vc: last_written_vc,
      view_timestamp: state.view_timestamp,
    },
  });
});

// GET endpoint
router.get("/:key", uninitialized_check, shard_check, (req, res) => {
  const key = req.params.key;

  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"]
    ? req.body["causal-metadata"]
    : {};

  let client_vc = causal_metadata_setup(causal_metadata);

  // attempts to send the key
  // return true if it sent,
  // otherwise false
  const attempt_send_key = () => {
    if (state.kvs.hasOwnProperty(key)) {
      let key_last_written = state.kvs[key].last_written_vc;
      // if key_last_written is newer/same/concurrent, return value
      // and causal metadata = max_vc(causal_metadata, key_last_written)
      if (compare_vc_all_nodes(key_last_written, client_vc) != "OLDER") {
        const new_client_vc = max_vc(client_vc, key_last_written);

        // If most recent write of key's value was deleting it
        if (state.kvs[key].value == null) {
          res.status(404).json({
            "causal-metadata": {
              vc: new_client_vc,
              view_timestamp: state.view_timestamp,
            },
          });
          return true;
        }

        res.status(200).json({
          val: state.kvs[key].value,
          "causal-metadata": {
            vc: new_client_vc,
            view_timestamp: state.view_timestamp,
          },
        });
        return true;
      }
    }

    // if total_vc is newer or same
    const total_vc_to_causal_metadata = compare_vc_shard(
      state.total_vc,
      client_vc
    );
    if (
      total_vc_to_causal_metadata == "NEWER" ||
      total_vc_to_causal_metadata == "EQUAL"
    ) {
      // If key was never written to, send 404 and client's VC back
      if (!state.kvs.hasOwnProperty(key)) {
        res.status(404).json({
          "causal-metadata": {
            vc: client_vc,
            view_timestamp: state.view_timestamp,
          },
        });
        return true;
      }

      // return value, causal_metadata = max_vc(causal_metadata, key_last_written)
      const key_last_written = state.kvs[key].last_written_vc;
      const new_client_vc = max_vc(client_vc, key_last_written);

      // If most recent write of key's value was deleting it
      if (state.kvs[key].value == null) {
        res.status(404).json({
          "causal-metadata": {
            vc: new_client_vc,
            view_timestamp: state.view_timestamp,
          },
        });
        return true;
      }

      res.status(200).json({
        val: state.kvs[key].value,
        "causal-metadata": {
          vc: new_client_vc,
          view_timestamp: state.view_timestamp,
        },
      });
      return true;
    }

    return false;
  };

  let sent = attempt_send_key();
  if (sent) {
    return;
  }

  // stalls, checks every 5s to see if it has updated due to gossip
  // and then tries to resend
  let i = 0;
  const intervalId = setInterval(() => {
    // basically run this method again
    sent = attempt_send_key();

    if (sent || i >= 3) {
      if (!sent) {
        res
          .status(500)
          .json({ error: "timed out while waiting for depended updates" });
      }

      clearInterval(intervalId);
    }

    i = i + 1;
  }, 5000);
});

// DELETE endpoint
router.delete("/:key", uninitialized_check, shard_check, (req, res) => {
  const key = req.params.key;

  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"]
    ? req.body["causal-metadata"]
    : {};

  let client_vc = causal_metadata_setup(causal_metadata);

  // last_written_vc = max of current thc and client, plus 1 for current write
  if (state.total_vc.hasOwnProperty(full_address)) {
    state.total_vc[full_address] += 1;
  } else {
    state.total_vc[full_address] = 1;
  }

  const last_written_vc = max_vc(client_vc, state.total_vc);

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
  };

  // BROADCAST KVS + T_VC TO ALL OTHER REPLICAS IN VIEW
  broadcast_kvs();

  res.status(response_code).json({
    "causal-metadata": {
      vc: last_written_vc,
      view_timestamp: state.view_timestamp,
    },
  });
});

// GET endpoint
router.get("/", uninitialized_check, (req, res) => {
  // if causal_metadata wasn't included in the body, send error
  if (!req.body || !req.body.hasOwnProperty("causal-metadata")) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  let causal_metadata = req.body["causal-metadata"]
    ? req.body["causal-metadata"]
    : {};

  let client_vc = causal_metadata_setup(causal_metadata);

  const attempt_send_kvs = () => {
    // if total_vc is newer or same, we can return our keys
    const total_vc_to_causal_metadata = compare_vc_shard(
      state.total_vc,
      client_vc
    );

    // console.log(total_vc_to_causal_metadata);
    if (
      total_vc_to_causal_metadata == "NEWER" ||
      total_vc_to_causal_metadata == "EQUAL"
    ) {
      let count = 0;
      const keys = [];

      for (const key in state.kvs) {
        // if the key's value is non-empty, add it
        if (state.kvs[key].value != null) {
          keys.push(key);
          count++;
        }
      }

      let new_client_vc = max_vc(state.total_vc, client_vc);

      res.status(200).json({
        "causal-metadata": {
          vc: new_client_vc,
          view_timestamp: state.view_timestamp,
        },
        count,
        keys,
      });

      return true;
    }

    return false;
  };

  let sent = attempt_send_kvs();

  if (sent) {
    return;
  }

  // stalls, checks every 5s to see if it has updated due to gossip
  // and then tries to resend
  let i = 0;
  const intervalId = setInterval(() => {
    // basically run this method again
    sent = attempt_send_kvs();

    if (sent || i >= 3) {
      if (!sent) {
        res
          .status(500)
          .json({ error: "timed out while waiting for depended updates" });
      }

      clearInterval(intervalId);
    }

    i = i + 1;
  }, 5000);
});

module.exports = router;
