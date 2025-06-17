/**
 *
 * @module brig/log
 */
'use strict';

const { EventEmitter } = require('node:events');
const { RoleChanged, LeaderChanged } = require('./events');
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
  append(logEntry) {
    if (logEntry instanceof LogEntry) {
      this.entries.push(logEntry);
    } else {
      throw new TypeError('Invalid LogEntry.');
    }
    return this;
  }

  /**
   * Get all the log entries after the supplied index.
   * @param {number} index - Starting log prefix.
   * @returns {Array.<module:brig/log~LogEntry>}
   */
  getEntriesAfterIndex(index) {
    return this.entries.slice(index, this.entries.length);
  }

  /**
   * Get the log entry at the supplied index.
   * @param {number} index - Entry index.
   * @returns {module:brig/log~LogEntry}
   */
  getEntryByIndex(index) {
    return this.entries[index];
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

  set currentTerm(val) {
    if (Number.isInteger(val) && !Number.isNaN(val)) {
      this._currentTerm = val;
    } else {
      throw new TypeError(`Invalid value "${val}".`);
    }
  }

  get currentTerm() {
    return this._currentTerm;
  }

  get currentLeader() {
    return this._currentLeader;
  }

  set currentLeader(val) {
    this.emit(LeaderChanged, this.currentLeader, val);
    this._currentLeader = val;
    return this.currentLeader;
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
  
    if (this.currentRole !== role) {
      this.emit(RoleChanged, this.currentRole, role);
    }

    return this.currentRole = role;
  }

  /**
   * Sets the current vote for the given ID.
   *
   * @param {buffer} id - Node ID to vote for.
   * @returns {module:brig/log~LogState}
   */
  voteFor(id) {
    this.votedFor = id;
    return this;
  }

  /**
   * The last term number.
   */
  get lastTerm() {
    if (this.log.entries.length > 0) {
      return this.log.entries[this.log.entries.length - 1].term;
    }
    return 0;
  }

  toJSON() {
    return {
      currentTerm: this.currentTerm,
      votedFor: this.votedFor,
      currentLeader: this.currentLeader,
      votesReceived: [...this.votesReceived.entries()],
      log: this.log.entries,
      commitLength: this.commitLength,
      sentLength: [...this.sentLength.entries()],
      ackedLength: [...this.ackedLength.entries()]
    };
  }

  /**
   * Serializes the state to a buffer.
   * 
   * @returns {buffer}
   */
  serialize() {
    return Buffer.from(JSON.stringify(this.toJSON()));
  }

  /**
   * Creates a Log state instance from the serialized  buffer.
   *
   * @static 
   * @param {buffer} serializedNodeState - Output from 
   * {@link module:brig/log~LogState#serialize}
   */
  static deserialize(buffer) {
    const nodeState = JSON.parse(buffer.toString());

    nodeState.votesReceived = new Set(nodeState.votesReceived);
    nodeState.sentLength = new Map(nodeState.sentLength);
    nodeState.ackedLength = new Map(nodeState.ackedLength);

    return new LogState(nodeState);
  }

}

module.exports.LogState = LogState;
module.exports.Log = Log;
module.exports.LogEntry = LogEntry;
