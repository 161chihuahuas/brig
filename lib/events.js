/**
 *
 * @module brig/events
 */
'use strict';

/**
 * Fired when a new election should begin.
 *
 * @event ElectionTimeout
 */
module.exports.ElectionTimeout = Symbol('brig/events~ElectionTimeout');

/**
 * Fired when node should replicate log to all followers.
 *
 * @event ReplicationTimeout
 */
module.exports.ReplicationTimeout = Symbol('brig/events~ReplicationTimeout');

/**
 * Fired when a vote request is received.
 *
 * @event VoteRequest
 * @param {module:brig/messages~VoteRequestMessage} vReq - Message recevied.
 */
module.exports.VoteRequest = Symbol('brig/events~VoteRequest');

/**
 * Fired when a reponse is received for a vote request.
 *
 * @event VoteResponse
 * @param {module:brig/messages~VoteResponseMessage} vRes - Response recevied.
 */
module.exports.VoteResponse = Symbol('brig/events~VoteResponse');

/**
 * Fired when a node requests entries to be appended to the log.
 *
 * @event LogRequest
 * @param {module:brig/messages~LogRequestMessage} lReq - Message recevied.
 */
module.exports.LogRequest = Symbol('brig/events~LogRequest');

/**
 * Fired when a response to append entries is received.
 *
 * @event LogResponse
 * @param {module:brig/messages~LogResponseMessage} lRes - Response received.
 */
module.exports.LogResponse = Symbol('brig/events~LogResponse');

/**
 * Fired when the application layer wishes to broadcast a log entry to the 
 * network.
 *
 * @event Broadcast
 * @param {object} payload - Key-value pairs to broadcast as new log entry.
 */
module.exports.Broadcast = Symbol('brig/events~Broadcast');

/**
 * Fired when an entry is commited to the log.
 *
 * @event LogCommit
 * @param {module:brig/log~LogEntry} entry - Entry that was committed.
 */
module.exports.LogCommit = Symbol('brig/events~LogCommit');

/**
 * Fired when the role is changed.
 *
 * @event RoleChanged
 * @param {module:brig/roles~Follower|module:brig/roles~Leader|module:brig/roles~Candidate} role
 */
module.exports.RoleChanged = Symbol('brig/events~RoleChanged');

/**
 * Fired when the role is changed.
 *
 * @event RoleChanged
 * @param {module:brig/roles~Follower|module:brig/roles~Leader|module:brig/roles~Candidate} role
 */
module.exports.LeaderChanged = Symbol('brig/events~LeaderChanged');

/**
 * Fired when a debug message is loggable.
 *
 * @event Debug
 * @param {string[]} messages - Message output arguments.
 */
module.exports.Debug = Symbol('brig/events~Debug');

