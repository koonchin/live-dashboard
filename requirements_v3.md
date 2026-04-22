# Muslin Pajamas — Live Stream Dashboard
# Requirements Document v3.0
> อ้างอิง codebase: `index_v2.html` + `App Script v2.0`
> วันที่จัดทำ: 3 เมษายน 2026

---

## สารบัญ

1. [REQ-01] Shift System Redesign
2. [REQ-02] Required Fields — Visual Distinction
3. [REQ-03] Plan vs Actual — Advanced Filter & Summary

---

## [REQ-01] Shift System Redesign

### ภาพรวม

ระบบกะปัจจุบันผูกกะกับเวลาแบบ fixed (เช่น Facebook เปิดเวลาเดิม, Shopee 2 กะ, TikTok 5 กะ) ซึ่งทำให้ยืดหยุ่นน้อย และไม่สามารถตรวจจับความแตกต่างระหว่าง MC Plan กับ Actual Entry ได้

### พฤติกรรมใหม่ที่ต้องการ

#### 1.1 โครงสร้างกะต่อ Platform

| Platform | จำนวนกะ | Label |
|----------|----------|-------|
| Shopee   | 5 กะ    | กะที่ 1, กะที่ 2, กะที่ 3, กะที่ 4, กะที่ 5 |
| TikTok   | 5 กะ    | กะที่ 1, กะที่ 2, กะที่ 3, กะที่ 4, กะที่ 5 |
| Facebook | 5 กะ    | กะที่ 1, กะที่ 2, กะที่ 3, กะที่ 4, กะที่ 5 |

> ไม่มีเวลากำกับใน label ของกะ — ใช้เพียงหมายเลขกะ (1–5)

#### 1.2 Input Fields ใหม่สำหรับเวลา (แทน shift time label เดิม)

เพิ่ม 2 ช่องกรอกข้อมูลทั้งใน **Data Entry Form** และ **MC Plan Form**:

| ชื่อ Field | ประเภท | ตัวอย่าง | หมายเหตุ |
|-----------|--------|----------|----------|
| `start_time` | time picker (HH:MM) | `07:30` | เวลาเริ่มไลฟ์จริง |
| `hours` | number (0.5 step) | `4.0` | จำนวนชั่วโมงที่ไลฟ์ |

#### 1.3 Default Start Time จาก Sheet LISTS

- ใน Google Sheet แท็บ `LISTS` ให้เพิ่มคอลัมน์สำหรับ **default start time** ต่อ Platform + กะ
- รูปแบบที่แนะนำใน LISTS:

| ShiftDefault_Platform | ShiftDefault_Shift | ShiftDefault_StartTime |
|----------------------|-------------------|----------------------|
| Shopee               | กะที่ 1          | 07:30                |
| Shopee               | กะที่ 2          | 10:00                |
| Shopee               | กะที่ 3          | 13:00                |
| Shopee               | กะที่ 4          | 16:00                |
| Shopee               | กะที่ 5          | 19:00                |
| TikTok               | กะที่ 1          | 07:00                |
| ...                  | ...               | ...                  |

- เมื่อ user เลือก Platform + กะ ให้ **auto-fill** `start_time` ด้วย default value จาก LISTS
- User ยังคง **แก้ไขได้เสมอ** (ไม่ lock)

#### 1.4 MC Plan vs Actual Time Mismatch Detection

- MC Plan และ Data Entry จะบันทึก `start_time` แยกกันอิสระ
- ระบบต้องสามารถ **แสดง mismatch** ระหว่าง plan time กับ actual time ได้ใน Plan vs Actual view (ดู REQ-03)
- เกณฑ์ mismatch: `|actual_start_time - plan_start_time| > 15 นาที` (ค่า threshold ควร configurable)

#### 1.5 Schema Changes ที่ต้องอัปเดต

**App Script — COLS object:**
```javascript
// เพิ่ม/แก้ไข
start_time: <col_index>,   // เวลาเริ่มไลฟ์ (HH:MM string)
hours: <col_index>,        // จำนวนชั่วโมง (ย้ายมาแทน hours เดิม)
```

**MCPlan Sheet — เพิ่มคอลัมน์:**
- Column F: `start_time` (HH:MM)
- Column G: `hours` (number)

**`handleAdd()` function:**
- รับ `entry.start_time` (string HH:MM)
- `entry.hours` ยังคงเดิม

**`readMcPlans()` function:**
- return เพิ่ม `start_time` และ `hours` ต่อแต่ละ plan record

---

## [REQ-02] Required Fields — Visual Distinction

### ภาพรวม

Field ที่จำเป็นต้องกรอกก่อน submit ต้องแยกแยะได้ทันทีด้วยสายตา

### Fields ที่เป็น Required

| Field | ชื่อ Label | หมายเหตุ |
|-------|-----------|----------|
| `sales` | ยอดขาย (฿) | ต้องมากกว่า 0 |
| `s1` | Support 1 | ต้องเลือกจาก dropdown |
| `mc` | MC | ต้องเลือกจาก dropdown |
| `hours` | ชม. ไลฟ์ | ต้องมากกว่า 0 |

### Visual Requirements

#### Label Styling

- Required fields ต้องมี **asterisk สีแดง** กำกับ: `ยอดขาย *`
- สี asterisk: `#E53E3E` (red-600)
- Font weight ของ label: `600` (semi-bold)

#### Input Border & Background

| State | Border | Background |
|-------|--------|------------|
| Empty / Untouched | `#E53E3E` (red) 1.5px | `#FFF5F5` (blush) |
| Filled / Valid | `#48BB78` (green) 1.5px | `#FFFFFF` |
| Invalid (submit attempt) | `#E53E3E` 2px + shake animation | `#FFF5F5` |

#### Error Message

- แสดงข้อความ error ใต้ field ที่ยังไม่กรอก เมื่อกด submit
- ตัวอย่าง: `"กรุณากรอกยอดขาย"`, `"กรุณาเลือก MC"`
- สี text: `#E53E3E`, font size: `0.75rem`

#### Submit Button

- ปุ่ม submit ต้อง **disable** จนกว่า required fields ครบ (หรือ validate ตอนกด)
- ทั้งสองแนวทางยอมรับได้ — ให้ dev เลือกตาม UX ที่เหมาะสม

#### Behavior Notes

- Validation เกิดขึ้นเมื่อ: (1) กด submit, (2) blur จาก field (optional แต่ recommended)
- ไม่ต้องทำ real-time validation ขณะพิมพ์

---

## [REQ-03] Plan vs Actual — Advanced Filter & Summary

### ภาพรวม

ส่วน `📊 Plan vs Actual` ปัจจุบัน filter ได้เฉพาะเดือน ต้องการเพิ่ม filter ที่ละเอียดขึ้น และเพิ่ม summary row

### 3.1 Date Range Filter (แทน Month Picker)

- เปลี่ยนจาก month dropdown เป็น **date range picker** (2 ช่อง: จากวันที่ / ถึงวันที่)
- รองรับ cross-month range เช่น `26/02/2026 — 25/03/2026`
- Default: 30 วันย้อนหลังจากวันปัจจุบัน
- ปุ่ม shortcut:

| Label | Range |
|-------|-------|
| 7 วัน | today-6 → today |
| 30 วัน | today-29 → today |
| เดือนนี้ | 1st of month → today |
| เดือนที่แล้ว | full previous month |

### 3.2 Match / Mismatch Filter

- Dropdown / Toggle เลือกได้ 3 โหมด:

| โหมด | แสดง |
|------|------|
| ทั้งหมด (default) | ทุก record |
| Plan ≠ Actual เท่านั้น | แสดงเฉพาะแถวที่ plan กับ actual ต่างกัน (ดู criteria ด้านล่าง) |
| Plan = Actual เท่านั้น | แสดงเฉพาะแถวที่ plan กับ actual ตรงกันทุก field |

**Mismatch Criteria** (ถือว่า "ต่างกัน" เมื่อเกิดอย่างใดอย่างหนึ่ง):
- MC ไม่ตรงกัน
- Platform ไม่ตรงกัน
- กะไม่ตรงกัน
- `start_time` ต่างกันเกิน threshold (default 15 นาที)
- มี Plan แต่ไม่มี Actual (no-show)
- มี Actual แต่ไม่มี Plan (unplanned live)

### 3.3 Additional Filters

Filter Bar ให้มี filter ดังนี้ (ทำงานร่วมกันแบบ AND):

| Filter | Type | ค่าที่เลือกได้ |
|--------|------|--------------|
| Platform | Multi-select checkbox | Shopee, TikTok, Facebook |
| กะ | Multi-select checkbox | กะที่ 1–5 |
| MC | Multi-select dropdown | รายชื่อ MC จาก LISTS |
| สถานะ | Dropdown | ทั้งหมด / Plan ≠ Actual / Plan = Actual |

- มีปุ่ม **"ล้าง Filter"** reset ทุก filter กลับ default
- แสดง **จำนวน record ที่กำลังดูอยู่** (เช่น "แสดง 12 จาก 45 รายการ")

### 3.4 Summary Row (ด้านล่างตาราง)

แสดง summary สำหรับ record ที่ filter อยู่ขณะนั้น:

| Column | Summary Type | หมายเหตุ |
|--------|-------------|----------|
| ยอดขาย (Actual) | SUM | format ฿#,##0 |
| ออเดอร์ (Actual) | SUM | |
| ชม. ไลฟ์ (Actual) | SUM | |
| SPH เฉลี่ย | AVG (weighted) | ยอดรวม / ชม.รวม |
| จำนวนกะ | COUNT | count rows |
| ยอดขาย (Plan) | — | ไม่มี plan sales ใน schema ปัจจุบัน — N/A หรือ "-" |

- Summary row มี background สี `#2C3E50` (dark), text สีขาว, font-weight bold
- ติด sticky ที่ด้านล่างของ table หรือแสดงเป็น card ใต้ตาราง

### 3.5 Table Columns ใน Plan vs Actual View

แนะนำให้แสดงคอลัมน์ดังนี้:

| # | Column | Source |
|---|--------|--------|
| 1 | วันที่ | plan / actual |
| 2 | Platform | plan |
| 3 | กะ | plan |
| 4 | MC (Plan) | plan |
| 5 | MC (Actual) | actual |
| 6 | เวลาเริ่ม (Plan) | plan.start_time |
| 7 | เวลาเริ่ม (Actual) | actual.start_time |
| 8 | ชม. (Actual) | actual.hours |
| 9 | ยอดขาย | actual.sales |
| 10 | ออเดอร์ | actual.orders |
| 11 | SPH | actual.sph |
| 12 | สถานะ | calculated |

**สถานะ Column:**

| สถานะ | เงื่อนไข | Badge Color |
|-------|---------|------------|
| ✅ ตรงกัน | plan = actual ทุก field | green |
| ⚠️ เวลาเปลี่ยน | MC ตรง แต่เวลาต่าง | yellow |
| ❌ MC เปลี่ยน | MC ไม่ตรง | red |
| 🔴 ไม่มี Actual | plan มี แต่ actual ไม่มี | dark red / gray |
| 🟡 ไม่มี Plan | actual มี แต่ plan ไม่มี | orange |

---

## สิ่งที่ต้องทำใน Google Sheet (LISTS tab)

| รายการ | Action |
|--------|--------|
| เพิ่มคอลัมน์ `ShiftDefault_Platform`, `ShiftDefault_Shift`, `ShiftDefault_StartTime` | เพิ่ม column ใหม่ใน LISTS |
| ลบคอลัมน์ shift time แบบเก่า (ถ้ามี) | ตรวจสอบและ cleanup |
| MCPlan sheet: เพิ่ม col F `start_time`, col G `hours` | Schema update |
| DATA_ENTRY sheet: ตรวจสอบ col สำหรับ `start_time` | เพิ่มถ้ายังไม่มี |

---

## API Changes Summary

### doGet — response เพิ่ม

```json
{
  "lists": {
    "ShiftDefaults": [
      { "platform": "Shopee", "shift": "กะที่ 1", "start_time": "07:30" },
      ...
    ]
  }
}
```

### doPost — add action

```json
{
  "action": "add",
  "entry": {
    "date": "2026-04-03",
    "platform": "Shopee",
    "shift": "กะที่ 1",
    "start_time": "07:45",
    "hours": 4.0,
    "mc": "กิ๊ง",
    "s1": "นุ่น",
    "sales": 85000,
    "orders": 42,
    "viewers": 1200
  }
}
```

### plan_bulk_set — เพิ่ม fields

```json
{
  "action": "plan_bulk_set",
  "plans": [
    {
      "date": "2026-04-03",
      "platform": "Shopee",
      "shift": "กะที่ 1",
      "start_time": "07:30",
      "hours": 4.0,
      "mc": "กิ๊ง",
      "type": "Live"
    }
  ]
}
```

---

## Out of Scope (v3.0)

- การ notify อัตโนมัติเมื่อพบ mismatch (ไว้ทำ v4.0)
- การ export Plan vs Actual เป็น Excel/PDF
- Role-based access (admin vs viewer)

---

## ลำดับการพัฒนาที่แนะนำ

1. **Backend first**: อัปเดต App Script — COLS, handleAdd, readMcPlans, ShiftDefaults ใน doGet
2. **Sheet setup**: เพิ่มคอลัมน์ใน LISTS, MCPlan
3. **REQ-01**: UI shift picker + start_time input + auto-fill จาก LISTS
4. **REQ-02**: Required field styling + validation
5. **REQ-03**: Date range filter → additional filters → mismatch logic → summary row
6. **QA**: ทดสอบ mismatch detection ครบทุก case

---

*จัดทำโดย: กิ๊ง / Muslin Pajamas | อ้างอิง App Script v2.0*
