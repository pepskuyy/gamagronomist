const fs = require('fs');
const { createHmac } = require('crypto');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

async function testApi() {
  const token = env.ACCURATE_API_TOKEN;
  const secret = env.ACCURATE_SIGNATURE_SECRET;
  const host = (env.ACCURATE_HOST || 'https://public.accurate.id').replace(/\/$/, '');

  if (!token || !secret) {
    console.error('Credentials not set');
    return;
  }

  const pageSize = 100
  const page = 1

  const params = new URLSearchParams()
  params.set('fields', 'id,number,transDate,status,customer,description,totalAmount,masterSalesman')
  params.set('sp.pageSize', String(pageSize))
  params.set('sp.page', String(page))
  params.set('sp.sort', 'transDate.desc')

  // Simulate front-end date
  const dateFrom = '2026-03-11'
  const dateTo = '2026-04-10'

  const from = dateFrom || '2000-01-01'
  const to = dateTo || '2100-12-31'
  
  const [fY, fM, fD] = from.split('-')
  const [tY, tM, tD] = to.split('-')
  
  if (from === to) {
    params.set('filter.transDate.op', 'EQUAL')
    params.set('filter.transDate.val', `${fD}/${fM}/${fY}`)
  } else {
    params.set('filter.transDate.op', 'BETWEEN')
    params.set('filter.transDate.val', `${fD}/${fM}/${fY}`)
    params.set('filter.transDate.val2', `${tD}/${tM}/${tY}`)
  }

  const url = `${host}/accurate/api/sales-order/list.do?${params.toString()}`;
  console.log('Fetching:', url);

  const timestamp = new Date().toISOString();
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex');

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Timestamp': timestamp,
        'X-Api-Signature': signature,
      }
    });
    const data = await res.json();
    console.log(JSON.stringify({s: data.s, d: Array.isArray(data.d) ? data.d.length : data.d}, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApi();
