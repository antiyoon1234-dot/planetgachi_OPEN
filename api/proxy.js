import https from 'https';

export default function handler(req, res) {
  const { type } = req.query;

  if (type !== 'auction') {
    return res.status(400).json({ error: '잘못된 type' });
  }

  const options = {
    hostname: 'api.planetearth.kr',
    path: '/auction/list',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.planetgachi.pe.kr',
      'Origin': 'https://www.planetgachi.pe.kr',
    }
  };

  https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        res.status(200).json(json);
      } catch (e) {
        res.status(500).json({ error: '파싱 실패', raw: data.slice(0, 300) });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: e.message });
  });
}
