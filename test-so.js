require('dotenv').config({ path: '.env' });
const { createHmac } = require('crypto');

async function testApi() {
  const token = process.env.ACCURATE_API_TOKEN;
  const secret = process.env.ACCURATE_SIGNATURE_SECRET;
  const host = (process.env.ACCURATE_HOST || 'https://public.accurate.id').replace(/\/$/, '');

  if (!token || !secret) {
    console.error('Credentials not set');
    return;
  }

  const fields = 'id,number,transDate,status,customer,description,grandTotal';
  const timestamp = new Date().toISOString();
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex');

  const url = `${host}/accurate/api/sales-order/list.do?fields=${encodeURIComponent(fields)}&sp.pageSize=1`;
  
  console.log('Fetching:', url);
  try {
    // using dynamic import for node-fetch if needed, or global fetch if node >= 18
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Timestamp': timestamp,
        'X-Api-Signature': signature,
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApi();
