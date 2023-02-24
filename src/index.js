// Sources:
// Set up Express server: https://levelup.gitconnected.com/set-up-and-run-a-simple-node-server-project-38b403a3dc09
// Docker stuff: https://www.youtube.com/watch?v=gAkwW2tuIqE
// Parse JSON request body: https://stackoverflow.com/questions/9177049/express-js-req-body-undefined
// AXIOS requests: https://axios-http.com/docs/req_config

const express = require('express');
const app = express();

// Middleware--

// Use method override header to support GET/DELETE requests with bodies.
app.use(function(req, res, next) {
    // If we find a method override header, replace our req.method with that value
    if (req.headers['x-http-method-override']) {
      req.method = req.headers['x-http-method-override'];
    //   console.log(req.method);
    }
    next();
})

const body_parser = require('body-parser');
app.use(body_parser.json());

// End middleware--

const axios = require('axios');

const full_address = process.env.ADDRESS || '0.0.0.0:13800';

const address_split = address.split(':');

if (address_split.length != 2) {
    console.log("No address or malformed address");
    return 1;
}

const address = address_split[0];
const port = parseInt(address_split[1]);

// initialized state
let initialized = false;
let view = [];

// example of key value pair
// key: { last_written_vc: vector_clock, value: value, timestamp: datetime }

// operations_list entry
// [ vector_clock_value, ... ]
// ip: clock_value (number of write operations this IP has done)

let kvs = {};
const operations_list = [];
const total_vc = {};

// View change endpoints

app.put('/kvs/admin/view', (req, res) => {
    // if view wasn't included in the body, send error
    if (!req.body.hasOwnProperty('view')) {
        res.status(400).json({"error": "bad PUT"});
        return;
    }

    // TODO: if views are the same (maybe do some set comparison?), just return

    let old_view = view;
    view = req.body.view;

    old_view.forEach((address) => {
        // Reset any node in the old view that isn't in the new view
        if (!view.includes(address)) {
            axios({
                url: `http://${address}/kvs/admin/view`,
                method: 'put',
                data: {'view': view},
                headers: {'X-HTTP-Method-Override': 'DELETE'}
            })
                .catch(err => {
                    // if server responded with an error, forward it to requester
                    if (err.response) {
                        res.status(err.response.status).json(err.response.data);
                    }
                });
        }
    });

    view.forEach((address) => {
        axios({
            url: `http://${address}/kvs/admin/view`,
            method: 'put',
            data: {'view': view, 'kvs': kvs},
        })
            .catch(err => {
                // if server responded with an error, forward it to requester
                if (err.response) {
                    res.status(err.response.status).json(err.response.data);
                }
            });
    })

    initialized = true;

});

app.get('kvs/admin/view', (req, res) => {
    res.status(200).json({"view": view});
});

app.delete('kvs/admin/view', (req, res) => {
    if (initialized) {
        initialized = false;
        view = [];
        kvs = {};
    
        res.status(200);
    }
    // if uninitialized, return error
    else {
        res.status(418).json({"error": "uninitialized"});
    }
});

// End of view change endpoints--

// PUT endpoint
app.put('/kvs', (req, res) => {

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
    if (!kvs.has(key)) {
        kvs[key] = val;
        res.status(201).json({"replaced": false});
        return;
    } 
    // otherwise, get old value before replacing, then send other response
    else {
        let old_val = kvs[key];
        kvs[key] = val;
        res.status(200).json({"replaced": true, "prev": old_val});
        return;
    }

});

// GET endpoint
app.get('/kvs', (req, res) => {

    // if key wasn't included in the body, send error
    if (!req.body.hasOwnProperty('key')) {
        res.status(400).json({"error": "bad GET"});
        return;
    } 

    let { key } = req.body;
    // if hash map doesn't have the key, send not found error
    if (!(key in kvs)) {
        res.status(404).json({"error": "not found"});
        return;
    } 
    // otherwise, send a successful response containing the value of the hash map's value
    else {
        let val = kvs[key];
        res.status(200).json({"val": val});
        return;
    }
});

// DELETE endpoint
app.delete('/kvs', (req, res) => {

    // if key wasn't included in the body, send error
    if (!req.body.hasOwnProperty('key')) {
        res.status(400).json({"error": "bad DELETE"});
        return;
    } 

    let { key } = req.body;
    // if hash map doesn't have the key, send not found error
    if (!(kvs in key)) {
        res.status(404).json({"error": "not found"});
        return;
    } 
    // otherwise, send a successful response containing the value of the hash map's value
    else {
        let old_val = kvs[key];
        // no errors, delete the hash map's value
        // kvs.delete(key);
        res.status(200).json({"prev": old_val});
        return;
    }
});

app.listen(port, () => {
    console.log(`Now listening on port ${port}`);
}); 
