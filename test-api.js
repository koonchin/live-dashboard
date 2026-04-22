// ทดสอบ Apps Script URL
// วิธีใช้: node test-api.js [URL]
// ตัวอย่าง: node test-api.js https://script.google.com/macros/s/XXXXX/exec

const url = process.argv[2];

if (!url) {
  console.log('❌ ต้องใส่ URL: node test-api.js <DEPLOYMENT_URL>');
  process.exit(1);
}

async function test(action) {
  const res = await fetch(`${url}?action=${action}&t=${Date.now()}`);
  const json = await res.json();
  return json;
}

(async () => {
  console.log('🔗 URL:', url);
  console.log('');

  // 1. data_sample — ดูว่า getData() คืนข้อมูลกี่แถว
  console.log('▶ action=data_sample ...');
  const sample = await test('data_sample');
  console.log('  DATA_START_ROW:', sample.DATA_START_ROW);
  console.log('  lastRow (sheet):', sample.lastRow);
  console.log('  getData_count  :', sample.getData_count);
  console.log('  first entry    :', JSON.stringify(sample.getData_first?.[0] ?? null));
  console.log('');

  // 2. get — ดูว่า data/mcPlans/config ครบไหม
  console.log('▶ action=get ...');
  const full = await test('get');
  console.log('  status      :', full.status);
  console.log('  data.length :', full.data?.length);
  console.log('  mcPlans.len :', full.mcPlans?.length);
  console.log('  config      :', JSON.stringify(full.config));
  console.log('');

  if (full.data?.length > 0) {
    console.log('✅ URL นี้ใช้ได้! — copy ไปใส่ index.html บรรทัด 995');
  } else {
    console.log('❌ data ยังว่าง — URL นี้อาจเป็น deployment เก่า');
    console.log('   ลอง deploy ใหม่แล้วเอา URL ใหม่มาทดสอบ');
  }
})();
