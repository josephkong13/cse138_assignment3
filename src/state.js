const state = {
  initialized: false, // initialized state
  view: [],
  // example of key value pair
  // key: { last_written_vc: vector_clock, value: value, timestamp: datetime }
  kvs: {},
  // ip: clock_value (number of write operations this IP has done)
  total_vc: {},
};

module.exports = state;
