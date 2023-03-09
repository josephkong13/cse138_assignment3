const state = {
  // initialized state
  initialized: false,
  nodes: [],
  // maps shard # to list of ip for that shard
  // example: {shard_number: [ip1, ip2] }
  view: [],
  // shard_numbers will be stricly positive, 0 is default (for uninitialized)
  shard_number: 0,
  view_timestamp: 0,
  // example of key value pair
  // key: { last_written_vc: vector_clock, value: value, timestamp: datetime }
  kvs: {},
  // ip: clock_value (number of write operations this IP has done)
  total_vc: {},
  // list of objects of the form { vshard_hash: shard_number }
  hashed_vshards_ordered: [],
  partition_testing: false,
  partition: [],
};

module.exports = state;
