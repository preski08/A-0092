/**
 * Mizu Blockchain Core
 * Used by the API server
 */

const CryptoJS = require('crypto-js');

class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = Number(amount);
    this.timestamp = Date.now();
    this.txId = CryptoJS.SHA256(
      String(fromAddress) + String(toAddress) + this.amount + this.timestamp
    ).toString().slice(0, 16);
  }
}

class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return CryptoJS.SHA256(
      this.index +
      this.previousHash +
      this.timestamp +
      JSON.stringify(this.transactions) +
      this.nonce
    ).toString();
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join('0');
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 50;
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), [], '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTx);

    const block = new Block(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
    return block;
  }

  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('fromAddress and toAddress are required');
    }
    if (transaction.amount <= 0) {
      throw new Error('amount must be > 0');
    }
    if (transaction.fromAddress !== null) {
      const balance = this.getBalanceOfAddress(transaction.fromAddress);
      if (balance < transaction.amount) {
        throw new Error('Insufficient balance');
      }
    }
    this.pendingTransactions.push(transaction);
    return transaction;
  }

  getBalanceOfAddress(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address) balance -= tx.amount;
        if (tx.toAddress === address) balance += tx.amount;
      }
    }
    return balance;
  }

  getTransactionHistory(address) {
    const history = [];
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          history.push({
            ...tx,
            blockIndex: block.index,
            blockHash: block.hash
          });
        }
      }
    }
    return history.reverse();
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      if (current.hash !== current.calculateHash()) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    return true;
  }

  replaceChain(newChain) {
    if (!newChain || newChain.length <= this.chain.length) return false;
    for (let i = 1; i < newChain.length; i++) {
      const curr = newChain[i];
      const prev = newChain[i - 1];
      const recalc = CryptoJS.SHA256(
        curr.index + curr.previousHash + curr.timestamp +
        JSON.stringify(curr.transactions) + curr.nonce
      ).toString();
      if (curr.hash !== recalc || curr.previousHash !== prev.hash) return false;
    }
    this.chain = newChain;
    return true;
  }

  toJSON() {
    return {
      chain: this.chain,
      pendingTransactions: this.pendingTransactions,
      difficulty: this.difficulty,
      miningReward: this.miningReward,
      length: this.chain.length,
      valid: this.isChainValid()
    };
  }
}

module.exports = { Blockchain, Transaction, Block };
