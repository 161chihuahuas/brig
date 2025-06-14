/**
 *
 * @module brig/log
 */
'use strict';


class LogEntry {

  /**
   *
   *
   * @constructor
   *
   */
  constructor() {
    // TODO
  }

}


class RaftLog {

  /**
   *
   *
   * @constructor
   * 
   */
  constructor(logState = {}) {
    this.entries = logState.entries || [];
  }

  /**
   *
   */
  append() {
    // TODO
  }

}

module.exports.RaftLog = RaftLog;
module.exports.LogEntry = LogEntry;
