// Sources:
// Set up Express server: https://levelup.gitconnected.com/set-up-and-run-a-simple-node-server-project-38b403a3dc09
// Docker stuff: https://www.youtube.com/watch?v=gAkwW2tuIqE
// Parse JSON request body: https://stackoverflow.com/questions/9177049/express-js-req-body-undefined
// AXIOS requests: https://axios-http.com/docs/req_config

/*
    - npm run dev: run the server in development mode
    - npm start: run the server (not in dev mode)
*/

const express = require("express");
const app = express();
const state = require("./state.js");
const viewchange = require("./api/viewchange");
const kvs = require("./api/kvs");
const { malformed_check, port } = require("./address");

// Middleware--

// Use method override header to support GET/DELETE requests with bodies.
app.use(function (req, res, next) {
  // If we find a method override header, replace our req.method with that value
  if (req.headers["x-http-method-override"]) {
    req.method = req.headers["x-http-method-override"];
    //   console.log(req.method);
  }
  next();
});

app.use(express.json());
/* Use the view change routes */
app.use("/kvs/admin/view", viewchange);
app.use("/kvs/data", kvs);

// End middleware--

if (malformed_check) {
  return 1;
}

app.listen(port, () => {
  console.log(`Now listening on port ${port}`);
});
