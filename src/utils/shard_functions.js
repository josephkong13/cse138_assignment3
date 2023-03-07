


// L is the list of tuples [ hash, shard ]
//
// given_hash is the one we're tryna search
// aka we're trying to find the hash directly after given_hash
//
// search_window is the size of the jump we're going to make
//
// index is the current index we're searching
//
// returns the tuple of next clockwise hash and its shard
const hash_search = (L, given_hash, search_window = L.length / 2, index = search_window) => {

  // if our index is bigger than the array this means we need to wrap around to the first node
  // since we're on a ring
  if(index >= L.length)
    return L[0];

  // destructure for hashes
  const [before_hash, shard1] = L[index];
  const [after_hash,  shard2] = L[index + 1];

  // this is the one we want
  // return the after/clockwise
  if(before_hash < given_hash && after_hash >= given_hash)
    return L[index + 1];

  const new_search_window = search_window > 2 ? search_window / 2 : 1;

  // we need to look further down in the array
  if(before_hash < given_hash && after_hash < given_hash)
    return hash_search(L, given_hash, new_search_window, index + search_window);

  // we're too far in the array
  if(before_hash > given_hash)
    return hash_search(L, given_hash, new_search_window, index - search_window);
}

