const full_address = process.env.ADDRESS || "0.0.0.0:13800";

const address_split = full_address.split(":");

if (address_split.length != 2) {
  console.log("No address or malformed address");
  return 1;
}

const address = address_split[0];
const port = parseInt(address_split[1]);

module.exports = { address, port };
