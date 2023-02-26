const state = require("../state");

const vc_value = function (vc, ip) {
  return vc[ip] ? vc[ip] : 0;
}
  
const max_vc = function (vc1, vc2) {
  const max_vc = {};
  state.view.forEach((ip_address) => {
    max_vc[ip_address] = Math.max(vc_value(vc1, ip_address), vc_value(vc2, ip_address));
  })
  
  return max_vc;
}

module.exports = { max_vc };
  