/**
 * @module brig/messages
 */
'use strict';


class VoteRequestMessage {

  /**
   * @typedef {object} module:brig/messages~VoteRequestMessageOptions
   * @property {buffer} peerId - Node ID to request vote for.
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
    this.method = 'REQUEST_VOTE';
    this.params = {
      peerId: params.peerId,
      currentTerm: params.currentTerm,
      currentLogLength: params.currentLogLength,
      currentLogLastTerm: params.currentLogLastTerm
    };
  }

}

module.exports.VoteRequestMessage = VoteRequestMessage;


class VoteResponseMessage {

  /**
   * @typedef {object} module:brig/messages~VoteResponseMessageOptions
   * @property {buffer} peerId - Node ID to request vote for.
   * @property {number} currentTerm - The current election term.
   * @property {boolean} voteCasted - Indicates if the peer was voted for.
   */

  /**
   *
   * @constructor
   * @param {module:brig/messages~VoteResponseMessageOptions} result - Result 
   * to include in response.
   */
  constructor(params = {}) {
    this.result = {
      peerId: params.peerId,
      currentTerm: params.currentTerm,
      voteCasted: params.voteCasted
    };
  }

}

module.exports.VoteResponseMessage = VoteResponseMessage;

class LogRequestMessage {

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
    this.method = 'APPEND_ENTRIES';
    this.params = {
      leaderId: params.leaderId,
      term: params.term,
      prefixLength: params.prefixLength,
      prefixTerm: params.prefixTerm,
      leaderCommit: params.leaderCommit,
      suffix: params.suffix
    };
  }

}

module.exports.LogRequestMessage = LogRequestMessage;


class LogResponseMessage {

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
    this.result = {
      followerId: params.followerId,
      term: params.term,
      ack: params.ack,
      success: params.success
    };
  }

}

module.exports.LogResponseMessage = LogResponseMessage;
