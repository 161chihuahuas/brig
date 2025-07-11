/**
 * @module brig/consensus
 * @see https://liangrunda.com/posts/raft-lite/
 */
'use strict';

const { Transform } = require('node:stream');
const { EventEmitter } = require('node:events');
const { LogState, LogEntry } = require('./log');

const {
  ElectionTimeout,
  ReplicationTimeout,
  VoteRequest,
  VoteResponse,
  LogRequest,
  LogResponse,
  Broadcast,
  LogCommit,
  RoleChanged,
  LeaderChanged,
  MessageQueued,
  Debug
} = require('./events');

const { Leader, Follower, Candidate } = require('./roles');

const {
  Message,
  VoteRequestMessage,
  VoteResponseMessage,
  LogRequestMessage,
  LogResponseMessage,
  BroadcastMessage
} = require('./messages');


class Peer extends EventEmitter {

  /**
   * User-defined function that receives address information for delivering
   * a message to a peer.
   *
   * @callback module:brig/consensus~peerTxHandler
   * @param {string} id - Peer identifier.
   * @param {module:brig/messages~Message} msg - Message to deliver.
   */

  /**
   * Abstract representation of a peer. Accepts any objectMode=true Duplex 
   * stream and a unique ID. Messages sent to peer will be written to the 
   * stream. {@link module:brig/consensus~Cluster} expects messages from 
   * peers to be read from this stream.
   *
   * @constructor
   * @extends EventEmitter
   * @param {string} id - Peer ID.
   * @param {module:brig/consensus~peerTxHandler} [tx] - User-defined transport.
   */
  constructor(id, tx) {
    super();

    this.id = id;

    this.tx = (_id, msg) => {
      this.emit(MessageQueued, _id, msg);
      tx && tx(_id, msg);
      return this;
    };
  }

  /**
   * Writes the message to the underlying stream.
   * @param {module:brig/messages~Message} message - The message to send.
   * @fires module:brig/events~MessageQueued
   * @returns {module:brig/consensus~Peer}
   */
  send(msg) {
    return this.tx(this.id, msg);
  }

}

module.exports.Peer = Peer;

/**
 * @property {number} ELECTION_T_MIN
 */
module.exports.ELECTION_T_MIN = 150;

/**
 * @property {number} ELECTION_T_MAX
 */
module.exports.ELECTION_T_MAX = 300;

/**
 * @property {number} REPLICATE_T
 */
module.exports.REPLICATE_T = 50;


class Cluster extends EventEmitter {

  /**
   * Election timeout in milliseconds plus a randomized additional time.
   * @returns {number}
   */
  static getElectionTimeoutMs() {
    const multiplier = module.exports.ELECTION_T_MAX - 
      module.exports.ELECTION_T_MIN;

    return module.exports.ELECTION_T_MIN + 
      Math.ceil(Math.random() * multiplier);
  }

  static getReplicateTimeoutMs() {
    return module.exports.REPLICATE_T;
  }

  /**
   * Primary brig interface. A synchronized, crash-fault-tolerant state 
   * machine consensus layer. Implements a Raft-like protocol.
   * 
   * @constructor
   * @param {buffer} id - Unique identifier for this node.
   * @param {Array.<module:brig/consensus~Peer>} [peers=[]] - Peer nodes.
   * @param {module:brig/log~LogState} [logState] - Initialize 
   * with the given state machine.
   */
  constructor(id, peers = [], logState) {
    super();

    /**
     * @property {string|number} id - Unique identifier for this context. 
     */
    this.id = id;
    /**
     * @property {module:brig/log~LogState} state - Underlying state machine.
     */
    this.state = logState
      ? logState 
      : new LogState();
    /**
     * @property {Array.<module:brig/consensus~Peer>} peers - Synchonized nodes.
     */
    this.peers = peers;

    this._bcastMsgBuffer = [];
  }

  /**
   * Initializes consensus algorithm.
   */
  join() {
    return this._init();
  }

  /**
   * Emits a debug event.
   *
   * @private
   */
  _dbg() {
    return this.emit(Debug, [...arguments]);
  }

  /**
   * Returns a map of METHOD -> HANDLER for integrating userland transport.
   *
   * returns {object.<string, function>}
   */
  createProtocolMapping() {
    this._dbg('Creating protocol mapping.');

    const mapping = {
      [VoteRequestMessage.method]: (msg, _ok) => {
        return this.emit(VoteRequest, Message.from(msg)) && _ok();
      },
      [VoteResponseMessage.method]: (msg, _ok) => {
        return this.emit(VoteResponse, Message.from(msg)) && _ok();
      },
      [LogRequestMessage.method]: (msg, _ok) => {
        return this.emit(LogRequest, Message.from(msg)) && _ok();
      },
      [LogResponseMessage.method]: (msg, _ok) => {
        return this.emit(LogResponse, Message.from(msg)) && _ok();
      },
      [BroadcastMessage.method]: (msg, _ok) => {
        return this.emit(Broadcast, Message.from(msg)) && _ok();
      }
    };

    return mapping;
  }

  /**
   * Binds event listeners to internal handler methods.
   * 
   * @private
   * @returns {module:brig/consensus~Cluster}
   */ 
  _init() {
    this._dbg('Initializing consensus module for node: ', this.id);

    this.state.on(RoleChanged, (oldRole, newRole) => {
      this._dbg('Node role changed from', oldRole, 'to', newRole);

      if (newRole === Leader) {
        this.startHeartbeat();
        clearTimeout(this._electionT);
      } else if (newRole === Follower) {
        this.resetElectionTimer();
        this.stopHeartbeat();
      } else {
        this.state.votesReceived.add(this.id);
        clearTimeout(this._electionT);
        this.stopHeartbeat();
      }
      
      this.emit(RoleChanged, oldRole, newRole);
    });

    this.state.on(LeaderChanged, (oldLeader, newLeader) => {
      if (this.state.currentLeader === this.id) {
        this.startHeartbeat();
      }

      if (oldLeader === newLeader) {
        return;
      }

      this._dbg('Node leader changed from', oldLeader, 'to', newLeader);
      
      while (this._bcastMsgBuffer.length) {
        const msg = this._bcastMsgBuffer.pop();
        
        this._dbg('Emptying broadcast buffer.', msg);
        this.getPeer(newLeader).send(msg);
      } 
      
      this.emit(LeaderChanged, oldLeader, newLeader);
    });

    this
      .on(ElectionTimeout, () => this.startElection())
      .on(ReplicationTimeout, () => this.handleReplicateLog())
      .on(VoteRequest, (vReq) => this.handleVoteRequest(vReq))
      .on(VoteResponse, (vRes) => this.handleVoteResponse(vRes))
      .on(LogRequest, (lReq) => this.handleLogRequest(lReq))
      .on(LogResponse, (lRes) => this.handleLogResponse(lRes))
      .on(Broadcast, (bCast) => this.handleBroadcast(bCast));

    this.resetElectionTimer();

    return this;
  }

  /**
   * Get peer from list by ID.
   * 
   * @param {string} peerId - Identifier for the peer node.
   * @returns {module:brig/consensus~Peer}
   */
  getPeer(id) {
    if (id === this.id) {
      throw new Error(
        'Tried to get peer object for self. This is probably not what you want'
      );
    }

    this._dbg('Looking for peer by ID: ', id);

    for (let i = 0; i < this.peers.length; i++) {
      if (this.peers[i].id === id) {
        this._dbg('Found peer: ', this.peers[i].id);
        return this.peers[i];
      }
    }

    this._dbg('Peer not found: ', id);

    return null;
  }

  /**
   * Adds a peer to the cluster.
   *
   * @param {module:brig/consensus~Peer} peer - Peer to add to cluster.
   * @returns {module:brig/consensus~Peer}
   */
  addPeer(peer) {
    this._dbg('Adding peer to cluster: ', peer.id);
    this.peers.push(peer);

    return this.getPeer(peer.id);
  }

  /**
   * Resets the election timeout.
   */
  resetElectionTimer() {
    this._electionT && clearTimeout(this._electionT);
    this._electionT = setTimeout(() => {
      this.emit(ElectionTimeout);
      this.resetElectionTimer();
    }, Cluster.getElectionTimeoutMs());
  }

  /**
   * Sends heartbeat messages to maintain authority and to replicate the log.
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this._heartbeatT = setInterval(() => {
      this.emit(ReplicationTimeout);
    }, Cluster.getReplicateTimeoutMs());
  }

  stopHeartbeat() {
    this._heartbeatT && clearInterval(this._heartbeatT);
  }
  
  /**
   * Each node has a election timer, which is reset when receving the heartbeat 
   * from its leader. When the Election Timer expires, the follower will 
   * transition to the role of “candidate”. Following this transition, it will 
   * proceed to send voting requests to all nodes.
   * 
   */
  startElection() {
    this._dbg('Starting leader election.');

    if (this.state.currentRole === Leader) {
      this._dbg('This node is already the Leader.');
      return;
    }

    if (this.state.currentRole === Candidate) {
      this._dbg('Node is already a Candidate.');
      return;
    }
    
    this._dbg('Advancing term.');
    this.state.currentTerm += 1;
    this.state.votedFor = this.id;

    this._dbg('Requesting votes and resetting election timer.');
    this.state.setCurrentRole(Candidate);
    this.state.votesReceived.clear();
    this.state.votesReceived.add(this.id);

    this._dbg('Voted for self:', this.state.votesReceived);
    let lastTerm = 0;

    if (this.state.log.entries.length > 0) {
      lastTerm = this.state.log.getEntryByIndex(
        this.state.log.entries.length - 1).term;
    }

    const msg = new VoteRequestMessage({
      candidateId: this.id, 
      currentTerm: this.state.currentTerm, 
      currentLogLength: this.state.log.entries.length, 
      currentLogLastTerm: lastTerm
    });

    for (let i = 0; i < this.peers.length; i++) {
      if (this.peers[i].id === this.id) {
        continue;
      }
      this._dbg('Sending message: ', msg, ' to peer: ', this.peers[i].id);
      this.getPeer(this.peers[i].id).send(msg);
    }

    return this;
  }

  /**
   * When the replication timer expires, the leader will synchronize its log 
   * with all followers. The synchronization message also serves as a heartbeat 
   * message.
   *
   */
  handleReplicateLog() {
    if (this.state.currentRole !== Leader) {
      this._dbg('Not clusters leader, so will not replicate.');
      return;
    }

    for (let i = 0; i < this.peers.length; i++) {
      if (this.peers[i].id === this.id) {
        continue;
      }

      this.replicateLog(this.id, this.peers[i]);
    }
  }

    /**
   * Helper function that synchronizes the log of the leader with a follower.
   * The simplest way to synchronize the log is to send the entire log to the 
   * follower. However, this is inefficient. As mentioned earlier, the leader 
   * assumes that the log of the follower is the same as its own log when it 
   * becomes a leader. Therefore, the leader only needs to send the log entries 
   * that the follower does not have.
   *
   * ```
   * sentLength[follower] := log.length 
   * // the node assumes that the log of the follower is the same as its own log
   * ```
   *
   * The leader maintains a variable `sentLength` for each follower. 
   * `sentLength[follower]` denotes the length of the log that the leader 
   * believes the follower has. When the leader synchronizes the logs with the 
   * follower, it will send the log entries after `sentLength[follower]`. If 
   * the synchronization is failed, the leader will decrease 
   * `sentLength[follower]` by 1, and try again.
   *
   * @param {string} leaderId - Peer ID to replicate from.
   * @param {module:brig/consensus~Peer} follower - Peer to replicate to.
   */
  replicateLog(leaderId, follower) {
    if (follower.id === this.id) {
      return;
    }

    this._dbg('Replicate log from', leaderId, 'to', follower.id);

    // We call the log entries that the leader believes are already replicated 
    // on the follower as prefix.
    const prefixLength = this.state.sentLength.get(follower.id);

    // Only send the suffix of the log to the follower.
    const suffix = this.state.log.getEntriesAfterIndex(prefixLength);

    // prefixTerm is the term of the last log entry in the prefix. We will 
    // explain it later.
    let prefixTerm = 0;

    if (prefixLength > 0) {
      let lastLogEntry = this.state.log.getEntryByIndex(prefixLength);

      prefixTerm = lastLogEntry
        ? lastLogEntry.term
        : this.state.currentTerm;
    }

    const msg = new LogRequestMessage({
      leaderId: leaderId,
      term: this.state.currentTerm,
      prefixLength,
      prefixTerm,
      leaderCommit: this.state.commitLength,
      suffix
    });

    this._dbg('Sending LogRequestMessage:', msg);
    follower.send(msg);
  }

  /**
   * When node A receives a voting request from node B, it will perform the 
   * following steps:  
   *
   * 1. Check if the term of B is greater than or equal the current term of A. 
   * If not, A will reject the voting request, since voting for B might result 
   * in multiple leaders in B’s term.
   * 
   * 2. Check if the log of B is more or equal up-to-date than the log of A. 
   * If not, A will reject the voting request, since voting for B might result 
   * in log entries being lost.
   * 
   * 3. Check if A has already voted for another candidate in the current term. 
   * If so, A will reject the voting request, since voting for B might result 
   * in multiple leaders in the current term.
   *
   * @param {module:brig/messages~VoteRequestMessage} vReq - Vote request 
   * message.
   */
  handleVoteRequest(vReq) {
    this._dbg('Handling VoteRequest: ', vReq);

    // If the term of the candidate is greater than the current term of the 
    // node, then the node should update its current term to the term of the 
    // candidate, and become a follower. This is because:
    // 
    // 1. If the current node is a follower: it doesn't make sense to stay in 
    // the current term, since the leader may crash or disconnect.
    // 
    // 2. If the current node is a leader: it might be disconnected from the 
    // network or crashed for a while. In this case, the current node should 
    // step down and become a follower.
    if (vReq.currentTerm > this.state.currentTerm) {
      this._dbg('VoteRequestMessage term:', vReq.currentTerm, 
        'is greater than our current term:', this.state.currentTerm,
        'Becoming a follower.')

      this.state.currentTerm = vReq.currentTerm;
      this.state.setCurrentRole(Follower);
      this.state.votedFor = null;
    }

    let lastTerm = 0;

    if (this.state.log.entries.length > 0) {
      lastTerm = this.state.log.entries[this.state.log.entries.length - 1].term;
    }
    // Check if the log of the candidate is more up-to-date than the log of 
    // the node. logOk means the log of the candidate is more up-to-date than 
    // the log of the current node.
    const logOk = vReq.currentLogLastTerm > lastTerm
      || (vReq.currentLogLastTerm === lastTerm && 
          vReq.currentLogLength >= this.state.log.entries.length);

    let granted = false;
    // 1. If the term of the candidate is less than the current term of the 
    // node, then the node should reject the vote request.
    //
    // 2. If the log of the candidate is not more up-to-date than the log of 
    // the node, then the node should reject the vote request.
    // 
    // 3. If the node has already voted for another candidate in the current 
    // term, then the node should reject the vote request. 
    if (vReq.currentTerm >= this.state.currentTerm
      && logOk 
      && (this.state.votedFor === null || this.state.votedFor === vReq.candidateId)) {
      this.state.votedFor = vReq.candidateId;
      granted = true;
    }

    const msg = new VoteResponseMessage({
      voterId: this.id,
      term: this.state.currentTerm,
      // If false this means the node does not vote for the candidate, and 
      // the node will inform the candidate its current term. This is 
      // because the candidate may have a smaller term, and the node should 
      // make the candidate to update its term.
      granted
    });

    this.getPeer(vReq.candidateId).send(msg);
  }

  /**
   * Upon receiving voting responses, a node should check whether it has 
   * received a majority of votes. If so, it should transition to the role of 
   * leader. Otherwise, it should remain a candidate.
   *
   * @param {module:brig/messages~VoteResponseMessage} vRes - Vote response 
   * message to handle.
   */
  handleVoteResponse(vRes) {
    this._dbg('Handling vote response: ', vRes);

    this.resetElectionTimer();
    this.state.votesReceived.add(this.id);
    
    const isCandidate = this.state.currentRole === Candidate;
    const isCurrentTerm = vRes.term === this.state.currentTerm;
    const minVotesToWin = Math.ceil((this.peers.length + 1) / 2);
   
    this._dbg(isCandidate 
      ? 'Node is a candidate.'
      : 'Node is not a candidate.');

    this._dbg('Role:', this.state.currentRole);
    this._dbg('Vote term:', vRes.term, 
      ', Current term:', this.state.currentTerm);

    // If the node is a candidate, and the term of the vote response is the 
    // same as the current term of the node, and the vote response is granted, 
    // then the node should add the voter to the list of votes received.
    if (isCandidate && isCurrentTerm && vRes.granted) {
      this._dbg('Received a vote for the current term.');
      this.state.votesReceived.add(vRes.voterId);
    }

    this._dbg('Votes received:', this.state.votesReceived.size, 
      '/', minVotesToWin);

    // If the node receives a majority of votes, then the node becomes a leader.
    if (this.state.votesReceived.size >= minVotesToWin) {
      this._dbg('Node won the election.');

      // The node becomes the leader of itself.
      this.state.setCurrentRole(Leader);  
      this.state.currentLeader = this.id;

      // For each follower, the node should send a heartbeat message to it.
      for (let i = 0; i < this.peers.length; i++) {
        if (this.peers[i].id === this.id) {
          continue;
        }

        // The node assumes that the log of the follower is the same as its 
        // own log.
        this.state.sentLength.set(this.peers[i].id, this.state.log.entries.length);

        // The node does not receive any ack from the follower.
        this.state.ackedLength.set(this.peers[i].id, 0);
      }
        
      this.handleReplicateLog();
    } else if (vRes.term > this.state.currentTerm) {
      this._dbg('Vote response is from a future term, following.');

      // However, if the term of the vote response is greater than the current 
      // term of the node, then the node should update its current term to the 
      // term of the vote response, and become a follower. This is because the 
      // current node is already out of date, and it should step down and 
      // become a follower to avoid multiple leaders in the current term.
      this.state.currentTerm = vRes.term;
      this.state.setCurrentRole(Follower);
      this.state.votedFor = null;
      this.resetElectionTimer();
    }
  }
 
  /**
   * When a follower receives a synchronization message from the leader, it 
   * will perform the following steps:
   *
   * 1. The follower will check whether the log is consistent with the log 
   * entries that the leader believes the follower has. If not, the follower 
   * will reject the synchronization request.
   *
   * 2. If the log is consistent, the follower will append the suffix log 
   * entries to its own log.
   *
   * 3. The follower will check whether the leader has committed any log 
   * entries. If so, the follower will commit the log entries that the leader 
   * has committed.
   * 
   * To check whether the log is consistent, the follower will compare the term 
   * of the last log entry in the prefix with leader’s prefix_term. If they are 
   * not equal, the log is inconsistent. It is true due to a property of Raft: 
   * if two nodes have the same log term at the same index, then they have the 
   * same log entries at and before that index. Here we don’t give the proof of 
   * this property, but you can find it in the original paper.
   * 
   * @param {module:brig/messages~LogRequestMessage} lReq - Append entries 
   * request message.
   */
  handleLogRequest(lReq) {
    this._dbg('Handling LogRequestMessage:', lReq);

    // If the term of the log request is greater than the current term of the 
    // node, then the node should become a follower of the leader.
    if (lReq.term > this.state.currentTerm) {
      this.state.currentTerm = lReq.term;
      this.state.votedFor = null;
      this.resetElectionTimer();
    } 

    // If the term of the log request is the same as the current term of the 
    // node, then the node should become a follower of the leader (the current 
    // node might be a candidate).
    if (lReq.term === this.state.currentTerm) {
      this.state.setCurrentRole(Follower); 
      this.state.currentLeader = lReq.leaderId;
      this.resetElectionTimer();
    }

    // If logOk is true, then the prefix of the leader is the same as the 
    // prefix of the follower. Otherwise, the leader should send the log 
    // request again.
    const logOk = (this.state.log.entries.length >= lReq.prefixLength) 
      && (lReq.prefixLength === 0 
        || this.state.log.entries[lReq.prefixLength - 1].term === lReq.prefixTerm);

    let ack = 0;
    let success = false;

    if (lReq.term === this.state.currentTerm && logOk) {
      // Update the log using suffix.
      this._dbg('Terms match and log ok, appending entries.', 
        'Prefix:', lReq.prefixLength, 'Leader commit:', lReq.leaderCommit,
        'Suffix:', lReq.suffix);
      this.appendEntries(lReq.prefixLength, lReq.leaderCommit, lReq.suffix);

      // The node should notify the leader that it has received the log 
      // entries.
      ack = lReq.prefixLength + lReq.suffix.length;
      success = true;
    }

    const msg = new LogResponseMessage({
      followerId: this.id,
      term: this.state.currentTerm,
      ack,
      success
    });

    this.getPeer(lReq.leaderId).send(msg);
  }

  /**
   * Appends the suffix log entries to the log of the follower. Here we check 
   * whether the follower has the same suffix log entries as the leader. If 
   * not, the follower will remove all the log entries after prefix from its 
   * log, and append the suffix log entries from leader to its log.
   *
   * @param {number} prefixLength - Number of entries before current.
   * @param {number} leaderCommit - Number of commits on the leader.
   * @param {Array.<module:brig/log~LogEntry>} suffix - Entries to append.
   */
  appendEntries(prefixLength, leaderCommit, suffix) {
    this._dbg('Appending entries, prefix: ', prefixLength, ', leader commit: ', 
      leaderCommit, ', suffix: ', suffix);

    // If the suffix of the leader is not empty, and the suffix of the follower 
    // is not empty.
    if (suffix.length > 0 && this.state.log.entries.length > prefixLength) {
      // Get the index of the last log entry that can be compared.
      let index = Math.min(this.state.log.entries.length, 
        prefixLength + suffix.length) - 1;

      // If they have different terms, then the suffix of the follower might be 
      // different from the suffix of the leader.
      if (this.state.log.entries[index].term !== suffix[index - prefixLength].term) {       
        // Remove the suffix of the follower.
        this.state.log.entries = this.state.log.entries.slice(0, prefixLength);
      }
    }

    // If the we can find log entries that can be appended. 
    if (prefixLength + suffix.length > this.state.log.entries.length) {
      for (let i = this.state.log.entries.length - prefixLength; i < suffix.length; i++) {
        // Append the log entries to the log.
        this.state.log.append(new LogEntry(suffix[i].data, suffix[i].term)); 
      }
    }

    // logs[0..leaderCommit − 1] are acknowledged by the majority of nodes, so 
    // we can commit those log entries.
    if (leaderCommit > this.state.commitLength) {
      for (let i = this.state.commitLength; i < leaderCommit; i++) {
        this.emit(LogCommit, this.state.log.entries[i]);
      }

      this.state.commitLength = leaderCommit;
    }
  }

  /**
   * When the leader receives a log response from a follower, it will perform 
   * the following steps:
   *
   * 1. If the synchronization is successful, the leader will update 
   * `ackedLength` and `sentLength` of the follower.
   *
   * 2. If the synchronization is failed, the leader will decrease `sentLength` 
   * of the follower by 1, and try again.
   *
   * @param {module:brig/messages~LogResponseMessage} lRes - Append entries 
   * response message.
   */
  handleLogResponse(lRes) {
    this._dbg('Handling LogResponseMessage:', lRes);

    if (lRes.term === this.state.currentTerm && this.state.currentRole === Leader) {
      if (lRes.success && lRes.ack >= this.state.ackedLength.get(lRes.followerId)) {
        this.state.sentLength.set(lRes.followerId, lRes.ack);
        this.state.ackedLength.set(lRes.followerId, lRes.ack);
        this.commitLogEntries();
      } else if (this.state.sentLength.get(lRes.followerId) > 0) {
        this.state.sentLength.set(lRes.followerId, 
          this.state.sentLength.get(lRes.followerId) - 1);
        this.replicateLog(this.getPeer(this.id), this.getPeer(lRes.followerId));
      }
    } else if (lRes.term > this.state.currentTerm) {
      this.state.currentTerm = lRes.term;
      this.state.setCurrentRole(Follower);
      this.state.votedFor = null;
      this.resetElectionTimer();
    }
  }

  /**
   * Helper function for broadcasting a log entry.
   *
   * @param {object} payload - Key-value pairs to include in log entry.
   * @returns {module:brig/consensus~Cluster}
   */
  broadcast(payload) {
    this._dbg('Broadcasting payload: ', payload);  
    return this.emit(Broadcast, new BroadcastMessage(payload));
  }

  /**
   * When the application layer triggers a broadcast, the leader will append 
   * the broadcast message to its log, and send the log entry to all followers. 
   * If the current node is not a leader, it will forward the broadcast message 
   * to the leader.
   *
   * @param {object} payload - Payload to be included in log entry broadcasted.
   */
  handleBroadcast(bCast) {
    // If the node is a leader, then it can directly append the message to its 
    // log.
    this._dbg('Handling BroadcastMessage:', bCast)

    if (this.state.currentRole === Leader || this.state.currentLeader === this.id) {
      this._dbg('Node is Leader. Appending and replicating.');
      const msg = bCast;
      this.state.log.append(new LogEntry(msg, this.state.currentTerm));

      // The node is synchronized with itself.
      this.state.ackedLength.set(this.id, this.state.log.entries.length);

      // Synchronize the log with all followers.
      this.handleReplicateLog();
    } else if (this.state.currentLeader !== null) {
      this._dbg('Node is not Leader, so replicating to the Leader.');
      // If the node is not a leader, but it follows a leader, then it should 
      // forward the request to the leader.
      const msg = bCast;
      this.getPeer(this.state.currentLeader).send(msg);
    } else { 
      this._dbg('Node is not Leader and does not follow one. Waiting.');
      // If the node is not a leader, and it does not follow a 
      // leader, then it should buffer the message until it follows a leader.
      this._bcastMsgBuffer.push(bCast);
    }
  }
    
  /**
   * If the leader receives a majority of acknowledgements for a log entry, it 
   * will commit the log entry.
   *
   */
  commitLogEntries() {
    const minAcks = ((this.peers.length + 1) + 1) / 2;
    let readyMax = 0;

    for (let i = this.state.commitLength + 1; i < this.state.log.entries.length + 1; i++) {
      if (this.acks(i) >= minAcks) {
        readyMax = i;
      }
    }

    if (readyMax > 0 && this.state.log.entries[readyMax - 1].term === this.state.currentTerm) {
      for (let i = this.state.commitLength; i < readyMax; i++) {
        this.emit(LogCommit, this.state.log.entries[i]);
      }

      this.state.commitLength = readyMax;
    }
  }

    /**
   * The number of nodes whose `ackedLength` is greater than or equal to x.
   *
   * @param {number} x - Minimum number of acks.
   * @returns {number}
   */
  acks(length) {
    let acks = 0;
   
    for (let len of this.state.ackedLength.values()) {
      if (len >= length) {
        acks += 1;
      }
    }

    return acks;
  }

}

module.exports.Cluster = Cluster;
