/**
 * Mizu Chain API Server
 * REST API + WebSocket for mobile / APK clients
 *
 * Endpoints:
 *   POST /api/login          → login / register (simple)
 *   GET  /api/balance/:addr  → get balance
 *   GET  /api/history/:addr  → transaction history
 *   POST /api/tx             → create transaction
 *   POST /api/mine           → mine block
 *   GET  /api/chain          → full chain
 *   GET  /api/status         → network status
 *   GET  /api/pending        → pending transactions
 *
 * WebSocket: ws://host/ws  → real-time events
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { Blockchain, Transaction } = require('./blockchain');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// ========== State ==========
const blockchain = new Blockchain();
const users = new Map();       // address → { password, createdAt }
const sessions = new Map();    // token → address
const clients = new Map();     // ws → { id, address }

// ========== Middleware ==========
app.use(cors());
app.use(bodyParser.json());

// Simple auth middleware
function auth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.body.token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Login first.' });
  }
  req.address = sessions.get(token);
  req.token = token;
  next();
}

// ========== REST API ==========

// Health
app.get('/', (req, res) => {
  res.json({
    name: 'Mizu Chain API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST /api/login',
      'GET  /api/balance/:address',
      'GET  /api/history/:address',
      'POST /api/tx',
      'POST /api/mine',
      'GET  /api/chain',
      'GET  /api/status',
      'GET  /api/pending',
      'WS   /ws'
    ]
  });
});

// Login / Register (very simple for demo)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const address = username.trim();

  if (!users.has(address)) {
    // Register
    users.set(address, {
      password,
      createdAt: Date.now()
    });
  } else {
    // Login
    if (users.get(address).password !== password) {
      return res.status(401).json({ error: 'Wrong password' });
    }
  }

  const token = uuidv4();
  sessions.set(token, address);

  res.json({
    success: true,
    token,
    address,
    balance: blockchain.getBalanceOfAddress(address),
    message: users.has(address) ? 'Login success' : 'Registered & logged in'
  });
});

// Get balance
app.get('/api/balance/:address', (req, res) => {
  const balance = blockchain.getBalanceOfAddress(req.params.address);
  res.json({ address: req.params.address, balance });
});

// Get history
app.get('/api/history/:address', (req, res) => {
  const history = blockchain.getTransactionHistory(req.params.address);
  res.json({ address: req.params.address, history });
});

// Create transaction (need auth)
app.post('/api/tx', auth, (req, res) => {
  const { to, amount } = req.body;
  if (!to || !amount) {
    return res.status(400).json({ error: 'to and amount required' });
  }

  try {
    const tx = new Transaction(req.address, to, amount);
    blockchain.addTransaction(tx);

    // Broadcast to all WS clients
    broadcast({
      type: 'new_tx',
      tx
    });

    res.json({
      success: true,
      tx,
      message: 'Transaction added to pending. Mine to confirm.'
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Mine block (need auth)
app.post('/api/mine', auth, (req, res) => {
  try {
    const block = blockchain.minePendingTransactions(req.address);

    broadcast({
      type: 'new_block',
      block,
      miner: req.address
    });

    res.json({
      success: true,
      block: {
        index: block.index,
        hash: block.hash,
        nonce: block.nonce,
        transactions: block.transactions.length
      },
      balance: blockchain.getBalanceOfAddress(req.address),
      message: `Block #${block.index} mined!`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full chain
app.get('/api/chain', (req, res) => {
  res.json(blockchain.toJSON());
});

// Status
app.get('/api/status', (req, res) => {
  res.json({
    chainLength: blockchain.chain.length,
    pendingTx: blockchain.pendingTransactions.length,
    difficulty: blockchain.difficulty,
    miningReward: blockchain.miningReward,
    valid: blockchain.isChainValid(),
    connectedClients: clients.size,
    registeredUsers: users.size
  });
});

// Pending transactions
app.get('/api/pending', (req, res) => {
  res.json({ pending: blockchain.pendingTransactions });
});

// ========== WebSocket ==========
wss.on('connection', (ws) => {
  const id = uuidv4().slice(0, 8);
  clients.set(ws, { id, address: null });

  ws.send(JSON.stringify({
    type: 'welcome',
    id,
    chainLength: blockchain.chain.length
  }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const client = clients.get(ws);

    if (msg.type === 'auth' && msg.token && sessions.has(msg.token)) {
      client.address = sessions.get(msg.token);
      ws.send(JSON.stringify({ type: 'auth_ok', address: client.address }));
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// ========== Start ==========
server.listen(PORT, () => {
  console.log('========================================');
  console.log('  Mizu Chain API Server');
  console.log('========================================');
  console.log(`  REST  : http://localhost:${PORT}`);
  console.log(`  WS    : ws://localhost:${PORT}/ws`);
  console.log('========================================');
  console.log('  Endpoints:');
  console.log('  POST /api/login');
  console.log('  GET  /api/balance/:address');
  console.log('  GET  /api/history/:address');
  console.log('  POST /api/tx          (auth)');
  console.log('  POST /api/mine        (auth)');
  console.log('  GET  /api/chain');
  console.log('  GET  /api/status');
  console.log('========================================\n');
});
