'use strict';

const { PassThrough } = require('node:stream');
const { randomUUID } = require('node:crypto');
const { expect } = require('chai');
const { events, consensus, roles } = require('..');


describe('@module brig/consensus', function() {

  const NODES = 3;
  const PEERS = [];
  const CONSENSUS = [];

  this.timeout(8000);

  before(async function() {
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

      CONSENSUS.push(new consensus.Cluster(peer.id, peers));
    }

     
    //really verbose logs
    for (let c = 0; c < CONSENSUS.length; c++) {
      CONSENSUS[c].on(events.Debug, messages => {
        console.log(
          `[ ${CONSENSUS[c].id} ]`,
          ...messages
        );
      });
    }
   
    for (let i = 0; i < CONSENSUS.length; i++) {
      const cluster = CONSENSUS[i];
      await (function() {
        return new Promise((resolve) => {
          setTimeout(function() {
            cluster.join();
            resolve();
          }, 200);
        });
      })()
    }
  });

  describe('~Cluster', function() {

    it('creates a valid instance', function() {
      expect(CONSENSUS[0]).to.be.instanceOf(consensus.Cluster);
    }); 

    it('starts an election', function(done) {
      CONSENSUS[0].once(events.ElectionTimeout, done);
    });

    it('broadcasts a log entry to peers to replicate', function(done) {
      CONSENSUS[0].broadcast({
        genesis: 'entry'
      });
      setTimeout(() => {
        CONSENSUS.forEach(c => {
          expect(c.state.log.entries).to.have.lengthOf(1);
          expect(c.state.log.entries[0].payload.genesis).to.equal('entry');
        });
        done()
      }, 1000);
    });

    it('can sync state transitions from all nodes', function(done) {
      this.timeout(3000 * CONSENSUS.length + 200);

      for (let i = 0; i < CONSENSUS.length; i++) {
        setTimeout(() => {
          CONSENSUS[i].broadcast({ publisher: CONSENSUS[i].id });
        }, Math.ceil(Math.random() * 300));
      }
      setTimeout(() => {
        CONSENSUS.forEach(c => {
          expect(c.state.log.entries).to.have.lengthOf(CONSENSUS.length + 1);
        });
        done();
      }, 3000 * CONSENSUS.length);
    });

  });

  after(function() {

  });

});
