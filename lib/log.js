/**
 *
 * @module brig/log
 */
'use strict';

const { EventEmitter } = require('node:events');
const { RoleChanged } = require('./events');
const { Follower, Leader, Candidate } = require('./roles');


class LogEntry {

  /**
   * Serializable wrapper for an arbitrary JSON object paired with the election 
   * term during which it was synchronized.
   *
   * @constructor
   * @param {object} payload - Key-value pairs.
   * @param {number} term - Election term.
   */
  constructor(payload = {}, term = 0) {
    this.payload = payload;
    this.term = term;
  }

}


class Log {

  /**
   * Serializable wrapper for a list of {@link module:brig/log/LogEntry}s.
   *
   * @constructor
   * @param {Array.<module:brig/log~LogEntry>} [entries] - Initialize with 
   * log entries.
   */
  constructor(entries = []) {
    this.entries = entries;
  }

  /**
   * Appends the entry to the log.
   *
   * @param {module:brig/log~LogEntry} logEntry - Entry to append.
   * @returns {module:brig/log~Log}
   */
  append(logEntry = new LogEntry()) {
    this.entries.push(logEntry);
    return this;
  }

}


class LogState extends EventEmitter {

  /**
   * @typedef {module:brig/log~LogStateOptions}
   * @property {number} [currentTerm=0] - Current election term. 
   * @property {string} [votedFor=null] - Peer ID voted for.
   * @property {Follower|Leader|Candidate} [currentRole=Follower] - Node role. 
   * @property {string} [currentLeader=null] - Peer ID for current leader.
   * @property {Set.<string>} [votesReceived] - Peer IDs for votes received.
   * @property {module:brig/log~Log} [log] - The underyling log.
   * @property {number} [commitLength=0] - Number of committed log entries.
   * @property {Map} [sentLength] - Number of messages sent.
   * @property {Map} [ackedLength] - Number of messages acknowledged.
   */

  /**
   * State machine synchronized by {@link module:brig/consensus~Consensus}.
   *
   * @constructor
   * @param {module:brig/log~LogStateOptions} [logState] - State 
   * to initialize with.
   */
  constructor(nodeState = {}) {
    super();

    this.currentTerm = nodeState.currentTerm || 0;
    this.votedFor = nodeState.votedFor || null;
    this.currentRole = nodeState.currentRole || Follower;
    this.currentLeader = nodeState.currentLeader || null;
    this.votesReceived = nodeState.votesReceived || new Set();
    this.log = new Log(nodeState.log);
    this.commitLength = nodeState.commitLength || 0;
    this.sentLength = nodeState.sentLength || new Map();
    this.ackedLength = nodeState.ackedLength || new Map();
  }

  /**
   * Increments the current term by 1.
   *
   * @returns {module:brig/consensus~NodeStateMachine}
   */
  toNextTerm() {
    this.currentTerm++;
    return this;
  }

  /**
   * Sets the current role to the given symbol.
   *
   * @param {module:brig/roles~Follower|module:brig/roles~Candidate|module:brig/roles~Follower} role - 
   * Symbol for the role to set.
   * @returns {module:brig/log~LogState} 
   */
  setCurrentRole(role) {
    if (![Follower, Candidate, Leader].includes(role)) {
      throw new Error('Invalid role.');
    }

    this.currentRole = role;

    return this.emit(RoleChanged, this.currentRole);
  }

  /**
   * Sets the current vote for the given ID.
   *
   * @param {buffer} id - Node ID to vote for.
   * @returns {module:brig/log~LogState}
   */
  voteFor(id) {
    this.votedFor = id;
    this.votesReceived.clear();
    this.votesReceived.add(id);
    return this;
  }

  /**
   * The last term number.
   */
  static get lastTerm() {
    if (this.log.entries.length > 0) {
      return this.log.entries[this.log.entries.length - 1].term;
    }
    return 0;
  }

}

module.exports.LogState = LogState;
module.exports.Log = Log;
module.exports.LogEntry = LogEntry;
