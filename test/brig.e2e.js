'use strict';

const { PassThrough } = require('node:stream');
const { randomUUID } = require('node:crypto');
const { expect } = require('chai');
const { events, consensus } = require('..');
const { ElectionTimeout } = require('../lib/events');


describe('@module brig/consensus', function() {

  const NODES = 8;
  const PEERS = [];
  const CONSENSUS = [];

  before(function() {
    for (let i = 0; i < NODES; i++) {
      PEERS.push(new consensus.Peer(randomUUID(), new PassThrough({
        objectMode: true
      })));
    }

    for (let p = 0; p < PEERS.length; p++) {
      let peer = PEERS[p];
      let peers = [];

      for (let c = 0; c < PEERS.length; c++) {
        peers.push(PEERS[c]);
      }

      CONSENSUS.push(new consensus.Consensus(peer.id, peers));
    }
  });

  describe('~Consensus', function() {

    it('creates a valid instance', function() {
      expect(CONSENSUS[0]).to.be.instanceOf(consensus.Consensus);
    }); 

    it('starts an election', function(done) {
      CONSENSUS[0].once(events.ElectionTimeout, done);
    });

    it('broadcasts log entry to peers', function() {
      CONSENSUS[0].emit(events.Broadcast, {
        hello: 'brig'
      });
    });

  });

  after(function() {

  });

});
