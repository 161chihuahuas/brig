/**
 * @module brig/messages
 */
'use strict';


class Message {

  constructor() {}

  static get VoteRequestOptions() {
    return [
      'candidateId',
      'currentTerm',
      'currentLogLength',
      'currentLogLastTerm'
    ].sort();
  }

  static get VoteResponseOptions() {
    return [
      'voterId',
      'term',
      'granted'
    ].sort();
  }
 
  static get LogRequestOptions() {
    return [
      'leaderId',
      'term',
      'prefixLength',
      'prefixTerm',
      'leaderCommit',
      'suffix'
    ].sort();
  } 

  static get LogResponseOptions() {
    return [
      'followerId',
      'term',
      'ack',
      'success'
    ].sort();
  }

  static get BroadcastOptions() {
    return [
      'payload'
    ].sort();
  }

  static from(obj) {
    const keys = JSON.stringify(Object.keys(obj).sort());

    switch (keys) {
      case JSON.stringify(Message.VoteRequestOptions):
        return new VoteRequestMessage(obj);
      case JSON.stringify(Message.VoteResponseOptions):
        return new VoteResponseMessage(obj);
      case JSON.stringify(Message.LogRequestOptions):
        return new LogRequestMessage(obj);
      case JSON.stringify(Message.LogResponseOptions):
        return new LogResponseMessage(obj);
      case JSON.stringify(Message.BroadcastOptions):
        return new BroadcastMessage(obj);
      default:
        throw new Error('Failed to detect message type from keys: ' + keys + '   ' + JSON.stringify(Message.VoteRequestOptions));
    }
  }

  serialize() {
    return JSON.stringify(this);
  }

}

module.exports.Message = Message;


class VoteRequestMessage extends Message {

  /**
   * @typedef {object} module:brig/messages~VoteRequestMessageOptions
   * @property {buffer} candidateId - Node ID to request vote for.
   * @property {number} currentTerm - The current election term.
   * @property {number} currentLogLength - The length of the candidates current log.
   * @property {number} currentLogLastTerm - The last term in the current log.
   */

  /**
   *
   * @constructor
   * @param {module:brig/messages~VoteRequestMessageOptions} options - Params 
   * to include in RV message.
   */
  constructor(params = {}) {
    super();
    this.candidateId = params.candidateId;
    this.currentTerm = params.currentTerm;
    this.currentLogLength = params.currentLogLength;
    this.currentLogLastTerm = params.currentLogLastTerm;
  }

  static get method() {
    return 'REQUEST_VOTE';
  }

}

module.exports.VoteRequestMessage = VoteRequestMessage;


class VoteResponseMessage extends Message {

  /**
   * @typedef {object} module:brig/messages~VoteResponseMessageOptions
   * @property {buffer} voterId - Node ID to request vote for.
   * @property {number} term - The current election term.
   * @property {boolean} granted - Indicates if the peer was voted for.
   */

  /**
   *
   * @constructor
   * @param {module:brig/messages~VoteResponseMessageOptions} result - Result 
   * to include in response.
   */
  constructor(params = {}) {
    super();
    this.voterId = params.voterId;
    this.term = params.term;
    this.granted = params.granted;
  }

  static get method() {
    return 'CAST_VOTE';
  }

}

module.exports.VoteResponseMessage = VoteResponseMessage;

class LogRequestMessage extends Message {

  /**
   * @typedef {object} module:brig/messages~LogRequestMessageOptions
   * @property {string} leaderId - The current leader.
   * @property {number} term - The current election term.
   * @property {number} prefixLength - Number of entries prior.
   * @property {number} leaderCommit - Latest commit from leader.
   * @property {Array.<module:brig/log~LogEntry>} suffix - Entries.
   */

  /**
   *
   * @constructor
   * @param {module:brig/messages~LogRequestMessageOptions} options - Params 
   * to include in AE message.
   */
  constructor(params = {}) {
    super();
    this.leaderId = params.leaderId;
    this.term = params.term;
    this.prefixLength = params.prefixLength;
    this.prefixTerm = params.prefixTerm;
    this.leaderCommit = params.leaderCommit;
    this.suffix = params.suffix;
  }

  static get method() {
    return 'APPEND_LOG';
  }

}

module.exports.LogRequestMessage = LogRequestMessage;


class LogResponseMessage extends Message {

  /**
   * @typedef {object} module:brig/messages~LogResponseMessageOptions
   * @property {string} followerId - Peer ID of the follower.
   * @property {number} term - Election term.
   * @property {number} ack - Total acks for the entry.
   * @property {boolean} success - True if peer  write the entry.
   */

  /**
   *
   * @constructor
   * @param {module:brig/messages~LogResponseMessageOptions} result - Result 
   * to include in response.
   */
  constructor(params = {}) {
    super();
    this.followerId = params.followerId;
    this.term = params.term;
    this.ack = params.ack;
    this.success = params.success;
  }

  static get method() {
    return 'ACK_APPEND';
  }

}

module.exports.LogResponseMessage = LogResponseMessage;


class BroadcastMessage extends Message {

  /**
   *
   * @constructor
   * @param {object} payload - Log entry data to replicate.
   */
  constructor(payload) {
    super();
    this.payload = payload;
  }

  static get method() {
    return 'REQUEST_LOG_RELAY';
  }

}

module.exports.BroadcastMessage = BroadcastMessage;
