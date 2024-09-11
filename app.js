const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
dotenv.config();

require('./fetchRewards');

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 60 * 1000
  }
}));

app.use(express.static('public'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(process.env.PASSWORD, 10);

  if (username === process.env.USERNAME && await bcrypt.compare(password, hashedPassword)) {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.send('Invalid login credentials');
  }
});

app.get('/', (req, res) => {
  if (process.env.LOGIN_REQUIRED === 'true' && !req.session.loggedIn) {
    res.redirect('/login');
  } else {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  }
});

const provider = new ethers.InfuraProvider('mainnet', process.env.INFURA_KEY);
const addresses = [];
let i = 1;
while (process.env[`ADDRESS_${i}`]) {
  addresses.push(process.env[`ADDRESS_${i}`]);
  i++;
}

async function fetchPrices() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,fetch-ai&vs_currencies=usd');
    return {
      ethPriceUsd: response.data.ethereum.usd,
      fetPriceUsd: response.data['fetch-ai'].usd
    };
  } catch (error) {
    console.error('Error fetching prices:', error);
    return { ethPriceUsd: 0, fetPriceUsd: 0 };
  }
}

async function getFetBalance(address) {
  try {
    const fetContract = new ethers.Contract(process.env.FET_CONTRACT_ADDRESS, ["function balanceOf(address owner) view returns (uint256)"], provider);
    const balance = await fetContract.balanceOf(address);
    return balance ? ethers.formatUnits(balance, 18) : '0.0';
  } catch (err) {
    return '0.0';
  }
}

async function getEthBalance(address) {
  try {
    const balance = await provider.getBalance(address);
    return balance ? ethers.formatEther(balance) : '0.0';
  } catch (err) {
    return '0.0';
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

app.get('/balance-updates', async (req, res) => {
  const { ethPriceUsd, fetPriceUsd } = await fetchPrices();
  
  const rewardsFilePath = path.join(__dirname, 'rewardsData.json');
  let rewardsData = { lastReward: [], nextReward: [] };

  try {
    const rawData = fs.readFileSync(rewardsFilePath, 'utf8');
    rewardsData = JSON.parse(rawData);
  } catch (error) {
    console.error('Error reading rewardsData.json:', error);
  }
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const totalAddresses = addresses.length;
  let totalEthBalance = 0n;
  let totalFetBalance = 0n;
  let completedAddresses = 0;

  for (const address of addresses) {
    const ethBalance = await getEthBalance(address);
    const fetBalance = await getFetBalance(address);

    totalEthBalance += ethers.parseEther(ethBalance);
    totalFetBalance += ethers.parseUnits(fetBalance, 18);

    completedAddresses++;
    const percentage = Math.floor((completedAddresses / totalAddresses) * 100);

    const lastRewardEntry = rewardsData.lastReward.find(reward => reward.address === address);
    const nextRewardEntry = rewardsData.nextReward.find(reward => reward.address === address);

    const data = {
      address,
      eth: parseFloat(ethBalance).toFixed(5),
      fet: parseFloat(fetBalance).toFixed(2),
      ethUsd: (parseFloat(ethBalance) * ethPriceUsd).toFixed(2),
      fetUsd: (parseFloat(fetBalance) * fetPriceUsd).toFixed(2),
      percentage,
      totalEth: parseFloat(ethers.formatEther(totalEthBalance)).toFixed(5),
      totalFet: parseFloat(ethers.formatUnits(totalFetBalance, 18)).toFixed(2),
      totalEthUsd: (parseFloat(ethers.formatEther(totalEthBalance)) * ethPriceUsd).toFixed(2),
      totalFetUsd: (parseFloat(ethers.formatUnits(totalFetBalance, 18)) * fetPriceUsd).toFixed(2),
      lastReward: lastRewardEntry ? lastRewardEntry.amount.toFixed(2) : 'N/A',
      lastUptime: lastRewardEntry ? formatUptime(lastRewardEntry.uptime) : 'N/A',
      nextReward: nextRewardEntry ? nextRewardEntry.amount.toFixed(2) : 'N/A',
      currentUptime: nextRewardEntry ? formatUptime(nextRewardEntry.uptime) : 'N/A',
      lastPosition: lastRewardEntry ? lastRewardEntry.index + 1 : 'N/A',
      currentPosition: nextRewardEntry ? nextRewardEntry.index + 1 : 'N/A',
      nodeID: lastRewardEntry ? lastRewardEntry.id : nextRewardEntry ? nextRewardEntry.id : 'N/A'
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  res.write('event: end\n');
  res.write('data: \n\n');
  res.end();
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
