// Sources:
// Set up Express server: https://levelup.gitconnected.com/set-up-and-run-a-simple-node-server-project-38b403a3dc09
// Docker stuff: https://www.youtube.com/watch?v=gAkwW2tuIqE
// Parse JSON request body: https://stackoverflow.com/questions/9177049/express-js-req-body-undefined
// AXIOS requests: https://axios-http.com/docs/req_config

const express = require('express');
const app = express();

const body_parser = require('body-parser');
const json_parser = body_parser.json();

const axios = require('axios');

const port = process.env.PORT || 13800;

const forwarding_address = process.env.FORWARDING_ADDRESS;

// endpoints for main instance (when there is no forwarding address)
if (!forwarding_address) {
    const hash_map = new Map();

    // PUT endpoint
    app.put('/kvs', json_parser, (req, res) => {

        // if key or val wasn't included in the body, send error
        if (!req.body.hasOwnProperty('key') || !req.body.hasOwnProperty('val')) {
            res.status(400).json({"error": "bad PUT"});
            return;
        } 

        let { key, val } = req.body;
        // if key or val is too long, send error
        if (key.length > 200 || val.length > 200) {       
            res.status(400).json({"error": "key or val too long"});
            return;
        }

        // no errors, insert the value into the hash map

        // brand new value (no replacing) has specific response
        if (!hash_map.has(key)) {
            hash_map.set(key, val);
            res.status(201).json({"replaced": false});
            return;
        } 
        // otherwise, get old value before replacing, then send other response
        else {
            let old_val = hash_map.get(key);
            hash_map.set(key, val);
            res.status(200).json({"replaced": true, "prev": old_val});
            return;
        }

    });

    // GET endpoint
    app.get('/kvs', json_parser, (req, res) => {

        // if key wasn't included in the body, send error
        if (!req.query.hasOwnProperty('key')) {
            res.status(400).json({"error": "bad GET"});
            return;
        } 

        let { key } = req.query;
        // if hash map doesn't have the key, send not found error
        if (!hash_map.has(key)) {
            res.status(404).json({"error": "not found"});
            return;
        } 
        // otherwise, send a successful response containing the value of the hash map's value
        else {
            let val = hash_map.get(key);
            res.status(200).json({"val": val});
            return;
        }
    });

    // DELETE endpoint
    app.delete('/kvs', json_parser, (req, res) => {

        // if key wasn't included in the body, send error
        if (!req.query.hasOwnProperty('key')) {
            res.status(400).json({"error": "bad DELETE"});
            return;
        } 

        let { key } = req.query;
        // if hash map doesn't have the key, send not found error
        if (!hash_map.has(key)) {
            res.status(404).json({"error": "not found"});
            return;
        } 
        // otherwise, send a successful response containing the value of the hash map's value
        else {
            let old_val = hash_map.get(key);
            // no errors, delete the hash map's value
            hash_map.delete(key);
            res.status(200).json({"prev": old_val});
            return;
        }
    });
}

// if we have a forwarding address, we are a follower instance.
else {

    const URL = `http://${forwarding_address}/kvs`;
    const timeout_ms = 10000;

    // PUT endpoint
    app.put('/kvs', json_parser, (req, res) => {

        // forward PUT request to upstream with 10 second timeout
        axios({
            url: URL,
            method: 'put',
            data: req.body,
            timeout: timeout_ms
        })
            // if we got a response from upstream, forward that response to our own requester
            .then((upstream_res) => {
                res.status(upstream_res.status).json(upstream_res.data);
            })
            .catch(err => {
                // if server responded with an error, forward it to client
                if (err.response) {
                    res.status(err.response.status).json(err.response.data);
                }
                // if we didn't receive response from upstream (either couldn't connect or timed out)
                else {
                    res.status(503).json({
                        "error": "upstream down", 
                        "upstream": forwarding_address});
                }
            })

    });

    // GET endpoint
    app.get('/kvs', json_parser, (req, res) => {

        // // forward GET request to upstream with 10 second timeout
        axios({
            method: 'get',
            url: URL,
            params: req.query,
            timeout: timeout_ms
        })
            // if we got a response from upstream, forward that response to our own requester
            .then((upstream_res) => {
                res.status(upstream_res.status).json(upstream_res.data);
            })
            .catch(err => {
                // if server responded with an error, forward it to client
                if (err.response) {
                    res.status(err.response.status).json(err.response.data);
                }
                // if we didn't receive response from upstream (either couldn't connect or timed out)
                else {
                    res.status(503).json({
                        "error": "upstream down", 
                        "upstream": forwarding_address});
                }
            })

    });

    // DELETE endpoint
    app.delete('/kvs', json_parser, (req, res) => {

        // forward DELETE request to upstream with 10 second timeout
        axios({
            url: URL,
            method: 'delete',
            params: req.query,
            timeout: timeout_ms
        })
            // if we got a response from upstream, forward that response to our own requester
            .then(upstream_res => {
                res.status(upstream_res.status).json(upstream_res.data);
            })
            .catch(err => {
                // if server responded with an error, forward it to client
                if (err.response) {
                    res.status(err.response.status).json(err.response.data);
                }
                // if we didn't receive response from upstream (either couldn't connect or timed out)
                else {
                    res.status(503).json({
                        "error": "upstream down", 
                        "upstream": forwarding_address});
                }
            })

    });

}

app.listen(port, () => {
    console.log(`Now listening on port ${port}`);
    console.log(`Our upstream is : ${forwarding_address}`)
}); 