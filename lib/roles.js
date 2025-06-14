/**
 * Symbols for different modes/roles a node can be in.
 * @module brig/roles
 */
'use strict';


/**
 * The node synchronizes and appends entries via leader.
 */
module.exports.Follower = Symbol('brig/roles~Follower');

/**
 * The node did not receive a heartbeat before the next election and is now 
 * requesting votes from peers.
 */
module.exports.Candidate = Symbol('brig/roles~Candidate');

/**
 * The node was elected leader and relays append entry requests to peers.
 */
module.exports.Leader = Symbol('brig/roles~Leader');
