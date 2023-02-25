const full_address = process.env.ADDRESS || "0.0.0.0";

const address_split = full_address.split(":");

let malformed_check = false;

if (address_split.length != 2) {
  console.log("No address or malformed address");
  malformed_check = true;
}

const address = address_split[0];
const port = parseInt(address_split[1]);

module.exports = { malformed_check, address, port };
