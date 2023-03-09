const XXHash = require("xxhash");

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

      const hash = XXHash.hash(Buffer.from(string_to_hash), 0xcafebabe);

      hashed_vshards_ordered.push([hash, shard_num]);
    }
  }

  // sort the list of (hash, shard_num) pairs by ascending hash
  // tiebreak with ascending shard_num
  hashed_vshards_ordered.sort((a, b) => {
    if (b[0] !== a[0]) {
      return a[0] - b[0];
    } else {
      return a[1] - b[1];
    }
  });

  return hashed_vshards_ordered;
};

module.exports = { hash_search, hash_sort, random_hash };
