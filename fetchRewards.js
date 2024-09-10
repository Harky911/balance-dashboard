const fs = require('fs');
const axios = require('axios');
const path = require('path');

const filePath = path.join(__dirname, 'rewardsData.json');
if (!fs.existsSync(filePath)) {
    console.log(`${filePath} does not exist. Creating it...`);
    fs.writeFileSync(filePath, JSON.stringify({ lastReward: [], nextReward: [] }, null, 2));
}

function getRewardTimestamps() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    const lastWednesday = new Date(now);
    let diff = (dayOfWeek + 3) % 7;

    if (!(dayOfWeek === 3 && now.getHours() >= 0)) {
        lastWednesday.setDate(lastWednesday.getDate() - diff);
    }
    lastWednesday.setHours(0, 0, 0, 0);

    const nextWednesday = new Date(now);
    diff = (10 - dayOfWeek) % 7;
    nextWednesday.setDate(nextWednesday.getDate() + diff);
    nextWednesday.setHours(0, 0, 0, 0);

    return {
        lastReward: Math.floor(lastWednesday.getTime() / 1000),
        nextReward: Math.floor(nextWednesday.getTime() / 1000)
    };
}

async function retryFetch(url, retries = 5, delay = 2000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            if (attempt < retries) {
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
            } else {
                console.error(`Failed to fetch after ${retries + 1} attempts:`, error.message);
                throw error;
            }
        }
    }
}

async function fetchAndSaveRewards(timestamps) {
    try {
        const { lastReward, nextReward } = timestamps;
        const lastUrl = `https://incentive-backend.oceanprotocol.com/rewards?date=${lastReward}`;
        const nextUrl = `https://incentive-backend.oceanprotocol.com/rewards?date=${nextReward}`;

        const lastRewardData = await retryFetch(lastUrl);
        const nextRewardData = await retryFetch(nextUrl);

        const combinedData = {
            lastReward: lastRewardData,
            nextReward: nextRewardData
        };

        fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2));
        console.log('Rewards data saved successfully');
    } catch (error) {
        console.error('Error fetching rewards data:', error.message);
    }
}

async function fetchRewards() {
    const timestamps = getRewardTimestamps();
    await fetchAndSaveRewards(timestamps);
}

setInterval(fetchRewards, 600000);
fetchRewards();
