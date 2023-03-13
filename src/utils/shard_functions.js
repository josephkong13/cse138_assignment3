const XXHash = require("xxhash");
const state = require("../state");
const seed = 0xcafebabe;

// L is the list of tuples [ hash, shard ]
//
// given_hash is the one we're tryna search
// aka we're trying to find the hash directly after given_hash
//
// uses a binary-search algorithm to get there
//
// returns the tuple of next clockwise hash and its shard
const hash_search = (L, given_hash) => {
  let lower_bound = 0;
  let upper_bound = L.length - 1;

  // either the hash is bigger than the biggest hash we have or smaller than the smallest
  // so we return the first element to wrap around since we're on a ring
  // after, we know the key is inbetween the largest and smallest hash
  if (L[upper_bound][0] < given_hash || L[lower_bound][0] > given_hash)
    return L[0];

  while (lower_bound < upper_bound) {
    let mid_point = Math.floor((upper_bound + lower_bound) / 2);

    let lower_hash = L[mid_point][0];
    let upper_hash = L[mid_point + 1][0];

    if (lower_hash < given_hash && upper_hash >= given_hash)
      return L[mid_point + 1];

    if (upper_hash < given_hash) lower_bound = mid_point;
    if (lower_hash > given_hash) upper_bound = mid_point;
  }

  throw Error("Bounds error");
};

// function to destructure and sort hashes
// ie. [].sort(hash_sort);
const hash_sort = ([hash1, shard1], [hash2, shard2]) => {
  if (hash1 < hash2) return -1;
  if (hash1 > hash2) return 1;

  if (shard1 < shard2) return -1;
  if (shard2 > shard1) return 1;

  return 0;
};

// helper function for testing
const random_hash = (length) => {
  return (Math.random() + 1).toString(36).substring(length);
};

const generate_hashed_vshards_ordered = (num_shards) => {
  let hashed_vshards_ordered = [];
  const vshards_per_shard = 100;

  // generate N vshards per shard and hash them all
  for (let shard_num = 1; shard_num <= num_shards; shard_num++) {
    for (let vshard_num = 0; vshard_num < vshards_per_shard; vshard_num++) {
      const string_to_hash = `shard${shard_num}_vshard${vshard_num}`;

      const hashed_string = hash(string_to_hash);

      hashed_vshards_ordered.push([hashed_string, shard_num]);
    }
  }

  // sort the list of (hash, shard_num) pairs by ascending hash
  // tiebreak with ascending shard_num
  hashed_vshards_ordered.sort(hash_sort);

  return hashed_vshards_ordered;
};

// take a list of nodes and spread them evenly into the shards
function nodes_to_shards(nodes, num_shards) {
  let view = [];

  for (let i = 0; i < num_shards; i++) {
    view.push({ shard_id: `${i + 1}`, nodes: [] });
  }

  let curr_shard = 0;
  nodes.forEach((address) => {
    view[curr_shard].nodes.push(address);
    curr_shard = (curr_shard + 1) % num_shards;
  });

  return view;
}

// take a new num_shards and breaks up the kvs into the proper shards
const reshard_kvs = (num_shards) => {
  const reshard = [];

  for (let i = 0; i < num_shards; i++) {
    reshard.push({});
  }

  for (let key in state.kvs) {
    const [_, shard_num] = hash_search(state.hashed_vshards_ordered, hash(key));
    reshard[shard_num - 1][key] = state.kvs[key];
  }
  return reshard;
};

const hash = (key) => {
  return XXHash.hash(Buffer.from(key), seed);
};

module.exports = {
  generate_hashed_vshards_ordered,
  hash_search,
  hash_sort,
  random_hash,
  nodes_to_shards,
  reshard_kvs,
  hash,
  seed,
};
