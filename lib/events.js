/**
 *
 * @module brig/events
 */
'use strict';

/**
 * Fired when a new election should begin.
 *
 * @event events~ElectionTimeout
 */
module.exports.ElectionTimeout = Symbol('brig/events~ElectionTimeout');

/**
 * Fired when .
 *
 * @event events~ReplicationTimeout
 */
module.exports.ReplicationTimeout = Symbol('brig/events~ReplicationTimeout');

/**
 * Fired when .
 *
 * @event events~VoteRequest
 */
module.exports.VoteRequest = Symbol('brig/events~VoteRequest');

/**
 * Fired when .
 *
 * @event events~VoteResponse
 */
module.exports.VoteResponse = Symbol('brig/events~VoteResponse');

/**
 * Fired when .
 *
 * @event events~LogRequest
 */
module.exports.LogRequest = Symbol('brig/events~LogRequest');

/**
 * Fired when .
 *
 * @event events~LogResponse
 */
module.exports.LogResponse = Symbol('brig/events~LogResponse');

/**
 * Fired when .
 *
 * @event events~Broadcast
 */
module.exports.Broadcast = Symbol('brig/events~Broadcast');

/**
 * Fired when .
 *
 * @event events~LogCommit
 */
module.exports.LogCommit = Symbol('brig/events~LogCommit');

