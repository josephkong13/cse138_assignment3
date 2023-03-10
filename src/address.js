const full_address = process.env.ADDRESS || "localhost:8080" || "0.0.0.0:8080"; // set to localhost for testing, change back to 0.0.0.0 later

const address_split = full_address.split(":");

let malformed_check = false;

// TODO: Check validity of address + port

if (address_split.length != 2) {
  console.log("No address or malformed address");
  malformed_check = true;
}

const address = address_split[0];
const port = parseInt(address_split[1]);

module.exports = { malformed_check, address, port, full_address };
