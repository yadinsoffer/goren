const axios = require('axios');
require('dotenv').config();

async function getSchedule(fromDate, toDate) {
    try {
        const response = await axios.get('https://api.arboxapp.com/index.php/api/v2/schedule', {
            headers: {
                'apiKey': 'ZKTC1IUV-YY9C-6JA8-PHVP-884TFOYNHNLB'
            },
            params: {
                from: fromDate,
                to: toDate
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching schedule:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getClientPurchases(userId) {
    try {
        const response = await axios.get('https://api.arboxapp.com/index.php/api/v2/users/membershipsData', {
            headers: {
                'apiKey': 'ZKTC1IUV-YY9C-6JA8-PHVP-884TFOYNHNLB'
            },
            params: {
                userId: userId
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching client purchases:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getAllActiveUsers(isStaff = false, isActive = 1) {
    try {
        const response = await axios.get('https://api.arboxapp.com/index.php/api/v2/users', {
            headers: {
                'apiKey': 'ZKTC1IUV-YY9C-6JA8-PHVP-884TFOYNHNLB'
            },
            params: {
                staff: isStaff,
                active: isActive
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { getSchedule, getClientPurchases, getAllActiveUsers }; 