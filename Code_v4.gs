// =============================================
// LIVE DASHBOARD — App Script v4.1
// =============================================
// Sheets used:
//   data_entry   — live / re-run entries
//   MC_Plan      — MC shift assignments
//   AdminPlan    — Admin shift assignments
//   LISTS        — dropdown values
//   Config       — cost/margin defaults (NEW v4.1)
// =============================================

const SS = SpreadsheetApp.getActiveSpreadsheet();
const DATA_SHEET   = 'DATA_ENTRY';   // Row1=Title, Row2=Instruction, Row3=Headers(TH), Row4+=Data
const PLAN_SHEET   = 'MCPlan';       // actual sheet name
const ADMIN_SHEET  = 'AdminPlan';
const LISTS_SHEET  = 'LISTS';
const CONFIG_SHEET = 'Config';
const RATES_SHEET  = 'Rates';        // NEW v4.2 — MC/Admin hourly rates
const DATA_START_ROW = 4;            // data rows start here (1-based)

// ── CORS helper ──────────────────────────────
function makeResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================
// doGet — main dispatcher
// =============================================
function doGet(e) {
  try {
    const action = e?.parameter?.action || 'get';
    const payload = e?.parameter?.payload ? JSON.parse(e.parameter.payload) : {};

    if (action === 'get') {
      return makeResp({
        status:     'ok',
        data:       getData(),
        mcPlans:    getMcPlans(),
        adminPlans: getAdminPlans(),
        lists:      getLists(),
        config:     getConfig(),       // v4.1 — cost/margin %
        rates:      getRates(),        // v4.2 — MC/Admin hourly rates per person
      });
    }
    // debug — returns raw headers from each sheet (ใช้ตรวจสอบชื่อ column)
    if (action === 'debug') {
      const raw  = SS.getSheetByName(DATA_SHEET);
      const plan = SS.getSheetByName(PLAN_SHEET);
      const getRow = (sh, rowNum) => sh && sh.getLastRow() >= rowNum
        ? sh.getRange(rowNum,1,1,sh.getLastColumn()).getValues()[0].map(String)
        : [];
      return makeResp({
        status: 'ok',
        all_sheet_names:     SS.getSheets().map(s => s.getName()),
        data_entry_row1:     getRow(raw, 1),
        data_entry_row2:     getRow(raw, 2),
        data_entry_row3:     getRow(raw, 3),
        data_entry_row4:     getRow(raw, 4),
        data_totalRows:      raw ? raw.getLastRow() : 0,
        mcplan_row1:         getRow(plan, 1),
        mcplan_row2:         getRow(plan, 2),
        mcplan_row3:         getRow(plan, 3),
        mcplan_totalRows:    plan ? plan.getLastRow() : 0,
      });
    }

    // data_sample — runs getData() and returns first 5 rows + diagnostics
    if (action === 'data_sample') {
      const sh2 = SS.getSheetByName(DATA_SHEET);
      if (!sh2) return makeResp({ status:'error', msg:'sheet not found', DATA_SHEET });
      const lr = sh2.getLastRow();
      const numRows = Math.min(5, lr - DATA_START_ROW + 1);
      const rawRows = numRows > 0
        ? sh2.getRange(DATA_START_ROW, 1, numRows, 23).getValues()
        : [];
      return makeResp({
        status:       'ok',
        DATA_SHEET,
        DATA_START_ROW,
        lastRow:      lr,
        rawRows:      rawRows.map(r => r.map(v => v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v))),
        getData_count: getData().length,
        getData_first: getData().slice(0, 3),
      });
    }

    if (action === 'add')                 return makeResp(handleAdd(payload));
    if (action === 'delete')              return makeResp(handleDelete(payload));
    if (action === 'plan_add')            return makeResp(handlePlanAdd(payload));
    if (action === 'plan_delete')         return makeResp(handlePlanDelete(payload));
    if (action === 'plan_bulk_set')       return makeResp(handlePlanBulkSet(payload));       // bulk replace plans for a date range
    if (action === 'admin_plan_add')      return makeResp(handleAdminPlanAdd(payload));
    if (action === 'admin_plan_delete')   return makeResp(handleAdminPlanDelete(payload));
    if (action === 'admin_plan_update')   return makeResp(handleAdminPlanUpdate(payload));

    return makeResp({ status: 'error', message: 'Unknown action: ' + action });
  } catch(err) {
    return makeResp({ status: 'error', message: err.message });
  }
}

// =============================================
// doPost — same as doGet (for fetch with mode=no-cors fallback)
// =============================================
function doPost(e) { return doGet(e); }

// =============================================
// getLists — dropdown values + config
// =============================================
function getLists() {
  const sh = SS.getSheetByName(LISTS_SHEET);
  if (!sh) return {};
  const dr   = sh.getDataRange();
  const vals = dr.getValues();         // raw values — for header row keys
  const disp = dr.getDisplayValues();  // display strings — time cells give "15:50" not Date objects
  const lists = {};
  for (let col = 0; col < vals[0].length; col++) {
    const key = String(vals[0][col]).trim();
    if (!key) continue;
    lists[key] = disp.slice(1)
      .map(r => r[col])
      .filter(v => v !== '' && v !== null && v !== undefined)
      .map(String);
  }
  return lists;
}

// =============================================
// getData — read data_entry sheet
// =============================================
function getData() {
  const sh = SS.getSheetByName(DATA_SHEET);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < DATA_START_ROW) return [];
  // Read data rows directly — skip title rows 1-3
  const rows = sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 23).getValues();
  // Column positions (1-based → 0-based index):
  // 1=วันที่  2=แพลตฟอร์ม  3=กะที่  4=ประเภท  5=ชื่อMC  6=Support1  7=Support2
  // 8=ยอดขาย  9=ออเดอร์  10=Viewers  11=ชั่วโมง  13=สาเหตุ  14=หมายเหตุ
  // 15=ShiftVariant  16=PromoUsed  17=HeroProducts  18=TechnicalIssues  23=start_time
  return rows.map(r => ({
    date:             formatDate(r[0]),
    platform:         String(r[1]  || ''),
    shift:            String(r[2]  || ''),
    type:             String(r[3]  || 'Live'),
    mc:               String(r[4]  || ''),
    s1:               String(r[5]  || ''),
    s2:               String(r[6]  || ''),
    sales:            toNum(r[7]),
    orders:           toNum(r[8]),
    viewers:          toNum(r[9]),
    hours:            toNum(r[10]),
    shift_variant:    String(r[14] || ''),
    start_time:       String(r[22] || ''),
    note:             String(r[13] || ''),
    reason:           String(r[12] || ''),
    promo_used:       String(r[15] || ''),
    hero_products:    String(r[16] || ''),
    technical_issues: String(r[17] || ''),
  })).filter(e => e.date && e.platform);
}

// =============================================
// ensureMcPlanSheet — สร้าง/แก้ไข MCPlan sheet ให้มี header row
// เรียกก่อนทุก operation ที่เกี่ยวกับ MCPlan
// =============================================
function ensureMcPlanSheet() {
  let sh = SS.getSheetByName(PLAN_SHEET);
  if (!sh) {
    sh = SS.insertSheet(PLAN_SHEET);
  }

  const HEADERS = ['date', 'platform', 'shift', 'mc', 'type', 'start_time', 'hours'];

  // ตรวจว่า row 1 col A ต้องเป็น 'date'
  const row1val = sh.getLastRow() > 0 ? String(sh.getRange(1, 1).getValue()).trim().toLowerCase() : '';
  if (row1val !== 'date') {
    // ไม่มี header → insert ที่ row 1
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#21373C').setFontColor('white');
    sh.getRange('A:A').setNumberFormat('@');
    SpreadsheetApp.flush();
    Logger.log('MCPlan: header row inserted');
  } else {
    // Header มีอยู่แล้ว — ตรวจว่า 'hours' column มีไหม
    const lastCol = sh.getLastColumn();
    const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v).trim().toLowerCase());
    if (!headerRow.includes('hours')) {
      // เพิ่ม hours column ต่อท้าย
      const hoursCol = lastCol + 1;
      sh.getRange(1, hoursCol).setValue('hours');
      sh.getRange(1, hoursCol).setFontWeight('bold').setBackground('#21373C').setFontColor('white');
      SpreadsheetApp.flush();
      Logger.log('MCPlan: hours column added at col ' + hoursCol);
    }
  }
  return sh;
}

// =============================================
// getMcPlans — read MC_Plan sheet
// =============================================
function getMcPlans() {
  const sh = ensureMcPlanSheet();
  if (sh.getLastRow() < 2) return []; // only header, no data
  const [header, ...rows] = sh.getDataRange().getValues();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[String(h).trim().toLowerCase()] = r[i]; });
    return {
      date:       formatDate(obj.date),
      platform:   String(obj.platform   || ''),
      shift:      String(obj.shift      || ''),
      mc:         String(obj.mc         || ''),
      type:       String(obj.type       || 'Live'),
      start_time: String(obj.start_time || ''),
      hours:      parseFloat(String(obj.hours || '').replace(/,/g,'')) || 4.0,
    };
  }).filter(p => p.date && p.platform && p.shift);
}

// =============================================
// getAdminPlans — read AdminPlan sheet (NEW v4.0)
// =============================================
function getAdminPlans() {
  const sh = SS.getSheetByName(ADMIN_SHEET);
  if (!sh) return [];
  const [header, ...rows] = sh.getDataRange().getValues();
  if (!header || !header.length) return [];
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[String(h).trim().toLowerCase()] = r[i]; });
    const onTimeVal = obj.on_time;
    let onTime = null;
    if (onTimeVal === true || onTimeVal === 'TRUE' || onTimeVal === 1)  onTime = true;
    if (onTimeVal === false || onTimeVal === 'FALSE' || onTimeVal === 0) onTime = false;
    return {
      date:        formatDate(obj.date),
      shift:       String(obj.shift || ''),
      admin_name:  String(obj.admin_name || ''),
      on_time:     onTime,
      actual_time: String(obj.actual_time || ''),
    };
  }).filter(p => p.date && p.shift);
}

// =============================================
// handleAdd — append to data_entry
// Column positions (1-based):
//  1=date  2=platform  3=shift  4=type  5=mc  6=s1  7=s2
//  8=sales  9=orders  10=viewers  11=hours
//  13=reason  14=note  15=shift_variant  16=promo_used
//  17=hero_products  18=technical_issues  23=start_time
// =============================================
function handleAdd(payload) {
  const sh = SS.getSheetByName(DATA_SHEET);
  if (!sh) return { status: 'error', message: 'Sheet not found: ' + DATA_SHEET };
  const entry = payload.entry || payload;
  // Build 23-column row matching exact sheet layout
  const newRow = new Array(23).fill('');
  newRow[0]  = entry.date;
  newRow[1]  = entry.platform;
  newRow[2]  = entry.shift;
  newRow[3]  = entry.type || 'Live';
  newRow[4]  = entry.mc || '';
  newRow[5]  = entry.s1 || '';
  newRow[6]  = entry.s2 || '';
  newRow[7]  = toNum(entry.sales);
  newRow[8]  = toNum(entry.orders);
  newRow[9]  = toNum(entry.viewers);
  newRow[10] = toNum(entry.hours) || '';
  newRow[12] = entry.reason || '';
  newRow[13] = entry.note || '';
  newRow[14] = entry.shift_variant || '';
  newRow[15] = entry.promo_used || '';
  newRow[16] = entry.hero_products || '';
  newRow[17] = entry.technical_issues || '';
  newRow[22] = entry.start_time || '';
  sh.appendRow(newRow);
  const lastRow = sh.getLastRow();
  // Force date column (col 1) to text to prevent auto-conversion
  const dateCell = sh.getRange(lastRow, 1);
  dateCell.setNumberFormat('@');
  dateCell.setValue(entry.date);
  // Force start_time column (col 23) to text
  const stCell = sh.getRange(lastRow, 23);
  stCell.setNumberFormat('@');
  stCell.setValue(entry.start_time || '');
  return { status: 'ok', rowIndex: lastRow - DATA_START_ROW };
}

// =============================================
// handleDelete — remove row from data_entry
// =============================================
function handleDelete(payload) {
  const sh = SS.getSheetByName(DATA_SHEET);
  if (!sh) return { status: 'error', message: 'Sheet not found: ' + DATA_SHEET };
  const rowIdx = payload.rowIndex; // 0-based index in data array
  if (rowIdx === undefined || rowIdx === null) return { status: 'error', message: 'rowIndex required' };
  const sheetRow = rowIdx + DATA_START_ROW; // data starts at row DATA_START_ROW (=4)
  if (sheetRow < DATA_START_ROW || sheetRow > sh.getLastRow()) return { status: 'error', message: 'Invalid row' };
  sh.deleteRow(sheetRow);
  return { status: 'ok' };
}

// =============================================
// handlePlanAdd — append to MC_Plan
// =============================================
function handlePlanAdd(payload) {
  const sh = ensureMcPlanSheet();
  const plans = Array.isArray(payload.plans) ? payload.plans : [payload];
  plans.forEach(p => {
    sh.appendRow([p.date, p.platform, p.shift, p.mc||'', p.type||'Live', p.start_time||'', parseFloat(p.hours)||4.0]);
    const lr = sh.getLastRow();
    const dc = sh.getRange(lr, 1); dc.setNumberFormat('@'); dc.setValue(p.date);
  });
  return { status: 'ok', count: plans.length };
}

// =============================================
// handlePlanDelete — remove MC plan row(s)
// =============================================
function handlePlanDelete(payload) {
  const sh = ensureMcPlanSheet();
  const { date, platform, shift, type } = payload;
  const [header, ...rows] = sh.getDataRange().getValues();
  const hMap = {}; header.forEach((h, i) => hMap[String(h).trim().toLowerCase()] = i);
  // Find matching rows (newest first to avoid index shift)
  const toDelete = [];
  rows.forEach((r, idx) => {
    const rDate  = formatDate(r[hMap.date  ?? 0]);
    const rPlat  = String(r[hMap.platform ?? 1] || '');
    const rShift = String(r[hMap.shift    ?? 2] || '');
    const rType  = String(r[hMap.type     ?? 4] || 'Live');
    if (rDate===date && rPlat===platform && rShift===shift && (!type||rType===type)){
      toDelete.push(idx + 2); // sheet row (1-based, +1 for header)
    }
  });
  toDelete.sort((a,b)=>b-a).forEach(row => sh.deleteRow(row));
  return { status: 'ok', deleted: toDelete.length };
}

// =============================================
// handlePlanBulkSet — replace all MC plans for given dates
// payload: { plans: [{date,platform,shift,mc,type,start_time},...] }
// Deletes all existing rows whose date appears in the plan list, then inserts new ones
// =============================================
function handlePlanBulkSet(payload) {
  const sh = ensureMcPlanSheet();
  const plans = Array.isArray(payload.plans) ? payload.plans : [];
  if (!plans.length) return { status: 'ok', count: 0 };

  // Collect unique dates being replaced
  const dates = new Set(plans.map(p => p.date).filter(Boolean));

  // Delete existing rows for those dates (bottom-up to preserve indices)
  const allRows = sh.getDataRange().getValues();
  const toDelete = [];
  allRows.forEach((r, idx) => {
    if (idx === 0) return; // skip header
    const rDate = formatDate(r[0]);
    if (dates.has(rDate)) toDelete.push(idx + 1); // 1-based sheet row
  });
  toDelete.sort((a, b) => b - a).forEach(row => sh.deleteRow(row));

  // Append new plans
  plans.forEach(p => {
    sh.appendRow([p.date, p.platform, p.shift, p.mc || '', p.type || 'Live', p.start_time || '', parseFloat(p.hours)||4.0]);
    const lr = sh.getLastRow();
    const dc = sh.getRange(lr, 1);
    dc.setNumberFormat('@');
    dc.setValue(p.date);
  });

  return { status: 'ok', count: plans.length };
}

// =============================================
// handleAdminPlanAdd — append to AdminPlan (NEW v4.0)
// =============================================
function handleAdminPlanAdd(payload) {
  let sh = SS.getSheetByName(ADMIN_SHEET);
  if (!sh) {
    sh = SS.insertSheet(ADMIN_SHEET);
    sh.appendRow(['date','shift','admin_name','on_time','actual_time']);
  }
  const plans = Array.isArray(payload.plans) ? payload.plans : [payload];
  plans.forEach(p => {
    // Remove existing plan for same date+shift first
    _deleteAdminRow(sh, p.date, p.shift);
    sh.appendRow([p.date, p.shift, p.admin_name||'', '', '']);
    const lr = sh.getLastRow();
    const dc = sh.getRange(lr, 1); dc.setNumberFormat('@'); dc.setValue(p.date);
  });
  return { status: 'ok', count: plans.length };
}

// =============================================
// handleAdminPlanDelete — remove admin plan (NEW v4.0)
// =============================================
function handleAdminPlanDelete(payload) {
  const sh = SS.getSheetByName(ADMIN_SHEET);
  if (!sh) return { status: 'ok', deleted: 0 };
  _deleteAdminRow(sh, payload.date, payload.shift);
  return { status: 'ok' };
}

// =============================================
// handleAdminPlanUpdate — update on_time / actual_time (NEW v4.0)
// =============================================
function handleAdminPlanUpdate(payload) {
  const sh = SS.getSheetByName(ADMIN_SHEET);
  if (!sh) return { status: 'error', message: 'AdminPlan sheet not found' };
  const [header, ...rows] = sh.getDataRange().getValues();
  const hMap = {}; header.forEach((h,i) => hMap[String(h).trim().toLowerCase()] = i);
  for (let i = 0; i < rows.length; i++) {
    const rDate  = formatDate(rows[i][hMap.date  ?? 0]);
    const rShift = String(rows[i][hMap.shift ?? 1] || '');
    if (rDate === payload.date && rShift === payload.shift) {
      const sheetRow = i + 2;
      if (payload.on_time !== undefined) {
        sh.getRange(sheetRow, (hMap.on_time ?? 3) + 1).setValue(
          payload.on_time === null ? '' : payload.on_time
        );
      }
      if (payload.actual_time !== undefined) {
        const atCell = sh.getRange(sheetRow, (hMap.actual_time ?? 4) + 1);
        atCell.setNumberFormat('@');
        atCell.setValue(payload.actual_time || '');
      }
      return { status: 'ok' };
    }
  }
  return { status: 'error', message: 'Row not found' };
}

// =============================================
// getConfig — read Config sheet (NEW v4.1)
// Returns object: { prod_cost_enabled, prod_cost_pct, ... }
// =============================================
function getConfig() {
  const sh = SS.getSheetByName(CONFIG_SHEET);
  if (!sh) return null; // ถ้ายังไม่มี sheet — frontend ใช้ default ของตัวเอง
  const rows = sh.getDataRange().getValues();
  const cfg = {};
  rows.forEach(r => {
    const key = String(r[0]).trim();
    const val = r[1];
    if (!key || key === 'key') return; // skip header
    // auto-convert TRUE/FALSE strings and numbers
    if (val === true  || val === 'TRUE')  { cfg[key] = true;  return; }
    if (val === false || val === 'FALSE') { cfg[key] = false; return; }
    const n = parseFloat(String(val).replace(/,/g,''));
    cfg[key] = isNaN(n) ? String(val) : n;
  });
  return cfg;
}

// =============================================
// ensureConfigSheet — run once to create Config sheet
// =============================================
function ensureConfigSheet() {
  let sh = SS.getSheetByName(CONFIG_SHEET);
  if (sh) { Logger.log('Config sheet already exists'); return; }
  sh = SS.insertSheet(CONFIG_SHEET);
  const defaults = [
    ['key',                    'value',  'หมายเหตุ'],
    ['prod_cost_enabled',      true,     'เปิด/ปิดต้นทุนสินค้า'],
    ['prod_cost_pct',          40,       '% ต้นทุนสินค้า (COGS)'],
    ['platform_fee_enabled',   true,     'เปิด/ปิดค่าธรรมเนียม Platform'],
    ['platform_fee_pct',       23,       '% ค่าธรรมเนียม Platform'],
    ['ads_enabled',            true,     'เปิด/ปิดค่าโฆษณา'],
    ['ads_pct',                15,       '% ค่าโฆษณา (Ads)'],
    ['mc_rate_enabled',        false,    'เปิด/ปิดหักค่า MC'],
    ['mc_rate',                500,      'ค่า MC ต่อกะ (฿)'],
  ];
  sh.getRange(1, 1, defaults.length, 3).setValues(defaults);
  // style header row
  sh.getRange(1,1,1,3).setFontWeight('bold').setBackground('#1ABC9C').setFontColor('white');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 80);
  sh.setColumnWidth(3, 220);
  SpreadsheetApp.flush();
  Logger.log('Config sheet created with defaults');
}

// =============================================
// getRates — read Rates sheet (NEW v4.2)
// Sheet columns: type | name | rate_per_hour | หมายเหตุ
// type = "MC" or "Admin"
// =============================================
function getRates() {
  const sh = SS.getSheetByName(RATES_SHEET);
  if (!sh) return null;
  const rows = sh.getDataRange().getValues().slice(1); // skip header row
  const mcRates = {};
  const adminRates = {};
  let mcDefault = null, adminDefault = null;
  rows.forEach(r => {
    const type = String(r[0]).trim().toLowerCase();
    const name = String(r[1]).trim();
    const rate = parseFloat(String(r[2]).replace(/,/g, ''));
    if (!name || isNaN(rate)) return;
    if (type === 'mc') {
      if (name.toLowerCase() === 'default') mcDefault = rate;
      else mcRates[name] = rate;
    } else if (type === 'admin') {
      if (name.toLowerCase() === 'default') adminDefault = rate;
      else adminRates[name] = rate;
    }
  });
  const result = { mcRates, adminRates };
  if (mcDefault    !== null) result.mcDefaultRate    = mcDefault;
  if (adminDefault !== null) result.adminDefaultRate = adminDefault;
  return result;
}

// =============================================
// ensureRatesSheet — run once to create Rates sheet
// Pre-fills MC names from LISTS sheet
// =============================================
function ensureRatesSheet() {
  let sh = SS.getSheetByName(RATES_SHEET);
  if (sh) { Logger.log('Rates sheet already exists'); return; }
  sh = SS.insertSheet(RATES_SHEET);

  // Header
  const header = [['type', 'name', 'rate_per_hour', 'หมายเหตุ']];
  sh.getRange(1, 1, 1, 4).setValues(header);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1ABC9C').setFontColor('white');

  // Pre-fill from MC_List in LISTS sheet
  const rows = [['MC', 'default', 500, 'ค่า default (ถ้าไม่มีชื่อ)']];
  const listsSh = SS.getSheetByName(LISTS_SHEET);
  if (listsSh) {
    const listVals = listsSh.getDataRange().getValues();
    // Find MC_List column
    const headerRow = listVals[0];
    const mcColIdx  = headerRow.findIndex(h => String(h).trim() === 'MC_List');
    if (mcColIdx >= 0) {
      listVals.slice(1).forEach(r => {
        const name = String(r[mcColIdx] || '').trim();
        if (name) rows.push(['MC', name, 0, '']);
      });
    }
  }
  // Placeholder admin rows
  rows.push(['Admin', 'default', 0, 'ค่า default Admin']);

  sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.setColumnWidth(1, 80);
  sh.setColumnWidth(2, 120);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 200);
  SpreadsheetApp.flush();
  Logger.log('Rates sheet created with ' + rows.length + ' rows');
}

// =============================================
// Helpers
// =============================================
function _deleteAdminRow(sh, date, shift) {
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const rDate  = formatDate(data[i][0]);
    const rShift = String(data[i][1] || '');
    if (rDate === date && rShift === shift) sh.deleteRow(i + 1);
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
  return String(val).slice(0, 10);
}

function toNum(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// =============================================
// ensureAdminSheet — call once from Apps Script
// editor to create the sheet with correct headers
// =============================================
function ensureAdminSheet() {
  let sh = SS.getSheetByName(ADMIN_SHEET);
  if (!sh) {
    sh = SS.insertSheet(ADMIN_SHEET);
    sh.appendRow(['date','shift','admin_name','on_time','actual_time']);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('@');
    SpreadsheetApp.flush();
    Logger.log('AdminPlan sheet created');
  } else {
    Logger.log('AdminPlan sheet already exists');
  }
}
