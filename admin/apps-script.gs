/**
 * The Abernathy Residence — private administrator back office (Google Apps Script + Google Sheet).
 *
 * Install / update:
 *   1. Paste this whole file into Code.gs and Save.
 *   2. Run setup() once (and again after every update). It adds any missing tabs, columns,
 *      drop-downs, protections and the automatic triggers. It never deletes your data.
 *   3. Deploy > Manage deployments > Edit > Version: New version > Deploy (the /exec URL stays the same).
 *
 * The public website can only: submit tour inquiries, submit service-information requests,
 * and read the list of ENABLED premium services (names, descriptions, benefits, images).
 * Prices, quotes, capacity, vacancies and resident details are never returned to the website.
 */
var SHEET_ID = '1slor0dhnt_Jyma6WbZ3G8Xbj6yI28C8e4CdFnU2RoaY'; // fallback; the Sheet this script made is remembered automatically

/* ---------- Tab layouts ---------- */
var T = {
  INQ: 'Inquiries', TOURS: 'Tours', TASKS: 'Tasks', ADM: 'Admissions', OCC: 'Occupancy',
  SVC: 'Services', REQ: 'Service requests', PRICE: 'Private pricing', STATS: 'Analytics',
  SET: 'Settings', LOG: 'Audit log'
};

var INQ_STATUS = ['New Inquiry', 'Needs Follow-Up', 'Pricing Discussion', 'Tour Approved', 'Tour Scheduled',
  'Tour Completed', 'Admission Review', 'Financial Verification', 'Waitlisted', 'Admitted', 'Closed'];
var REVIEW = ['Pending', 'Approved', 'Not approved', 'Not needed'];

var COLS = {};
COLS[T.INQ] = ['Inquiry ID', 'Received', 'Status', 'Urgent', 'Flags for review', 'Source',
  'Submitted by', 'Resident name', 'Resident age', 'Contact name', 'Relationship to resident', 'Phone', 'Email',
  'Contact consent', 'Reminder consent',
  'Occupancy request', 'Spouse/partner relationship', 'Room preference', 'Number of prospective occupants',
  'Spouse/partner care needs', 'Spouse/partner age', 'Spouse/partner move-in',
  'Placement type', 'Respite arrival', 'Respite departure', 'Housing-only follow-up', 'Current living arrangement',
  'Move-in timeframe', 'Daily-living help', 'Mobility', 'Medication assistance', 'Continuous skilled nursing',
  'Memory / overnight supervision', 'Accessibility & other considerations',
  'Funding', 'Sponsor relationship', 'Sponsor will discuss payment', 'Monthly income (approx.)',
  'Family or sponsor contribution', 'Payment coordinator', 'Wants private-pay discussion', 'Understands private pay',
  'Resident interested', 'Tour attendees', 'Preferred tour date', 'Preferred tour window',
  'Premium services interest', 'Premium categories', 'Additional questions',
  'Room suitability review', 'Licensed capacity verification', 'Admission eligibility review',
  'Private financial consultation', 'Assigned to', 'Next follow-up', 'Staff notes', 'Last updated'];
COLS[T.TOURS] = ['Inquiry ID', 'Contact name', 'Phone', 'Email', 'Reminder consent', 'Requested date', 'Requested window',
  'Tour status', 'Confirmed date', 'Confirmed time', 'Assigned staff', 'Action', 'Action sent', 'Reminder sent', 'Notes'];
COLS[T.TASKS] = ['Created', 'Type', 'Reference ID', 'Task', 'Due', 'Owner', 'Done', 'Notes'];
COLS[T.ADM] = ['Inquiry ID', 'Resident name', 'Opened', 'Applicant/representative interview', 'Physical examination documentation',
  'ADL assessment', 'Mobility & emergency evacuation', 'Medication assistance', 'Dietary needs', 'Cognitive & safety support',
  'Overnight supervision', 'Resident preferences', 'Authorized representatives', 'Individualized care suitability',
  'Licensed capacity & bed availability verified', 'Written admission agreement', 'Resident rights & required consents',
  'Financial arrangements', 'Service plan deadline', 'Decision', 'Approved by', 'Decision date', 'Notes'];
COLS[T.OCC] = ['Room', 'Room type', 'Verified vacant', 'Current occupant (inquiry ID)', 'Move-in status', 'Move-in date', 'Notes'];
COLS[T.SVC] = ['Show on website', 'Availability confirmed', 'Authorization confirmed', 'Staffing ready', 'Operationally ready',
  'Type', 'Key', 'Name', 'Short description', 'Benefits (one per line)', 'Learn more', 'Image', 'Inclusions & frequency (admin)', 'Admin notes'];
COLS[T.REQ] = ['Request ID', 'Received', 'Status', 'Service', 'Name', 'Phone', 'Email', 'Message', 'Contact consent',
  'Related inquiry ID', 'Quote (private)', 'Direct cost (private)', 'Written charges & terms provided', 'Authorized by resident/representative',
  'Authorization date', 'Scheduled for', 'Fulfilled', 'Billed', 'Acknowledgment recorded', 'Notes'];
COLS[T.PRICE] = ['Item', 'Category', 'Rate', 'Unit', 'Deposit', 'Direct cost', 'Contribution margin', 'Terms', 'Effective date',
  'Approved by', 'Notes'];
COLS[T.LOG] = ['When', 'Who', 'Tab', 'Cell', 'Old value', 'New value'];

var DEFAULT_SETTINGS = [
  ['Admin notification email', 'info@theabernathyresidence.com'],
  ['Business name', 'The Abernathy Residence'],
  ['Business phone', '(678) 898-2995'],
  ['Tour hours', 'Daily, 10 a.m. to 6 p.m. Eastern'],
  ['Send applicant acknowledgment', 'Yes'],
  ['Send tour reminders (day before)', 'Yes'],
  ['Max website submissions per minute', '20'],
  ['Data retention (months, closed inquiries) — review manually', '24'],
  ['Template: acknowledgment', 'Thank you for your interest in {business}. We received your answers ({id}). If you have not picked a tour time yet, you can choose one on our website calendar.\n\nQuestions? Call {phone}.'],
  ['Template: tour confirmation', 'Your private tour of {business} is confirmed for {date} at {time}. Reference {id}.\n\nTo change it, call {phone}.'],
  ['Template: propose new time', 'Thank you for your tour request ({id}). The time you asked for is not available. Could we offer {date} at {time} instead? Please call {phone} or reply to this email.'],
  ['Template: request information', 'Thank you for your tour request ({id}). Before we schedule your visit, our administrator would like to ask a few more questions. Please call {phone} at a convenient time.'],
  ['Template: discuss alternative placement', 'Thank you for your tour request ({id}). Our administrator would like to talk with you about the best placement options for your loved one. Please call {phone} at a convenient time.'],
  ['Template: tour reminder', 'A reminder that your private tour of {business} is tomorrow, {date} at {time}. Reference {id}. Call {phone} if anything changes.'],
  ['Template: service request received', 'Thank you for asking about {service} at {business} ({id}). Our administrator will contact you privately with details.']
];

var SERVICES = [
  ['Service', 'dining', 'Signature Dining', 'Specialty chef-prepared meals and celebrations around the table.', 'Gourmet selections and premium desserts\nThemed dinners\nFamily dining and celebration meals', 'Specialty chef-prepared meals, gourmet selections, themed dinners, premium desserts, family dining experiences and celebration meals.', 'img/rooms/dining.jpg'],
  ['Service', 'transport', 'Private Transportation & Concierge', 'A personal driver for the outings and errands that matter.', 'Shopping and restaurant visits\nFamily events and private outings\nPersonalized errands', 'Personal chauffeur arrangements for shopping, restaurant visits, family events, private outings and personalized errands.', ''],
  ['Service', 'family', 'Family Connection Concierge', 'Help staying close to family, near and far.', 'Scheduled video-call assistance\nAuthorized photo albums and digital greetings\nFamily celebration coordination', 'Extra scheduled video-call assistance, authorized photo albums, digital greetings, family celebrations and personalized event coordination.', 'img/rooms/second-living.jpg'],
  ['Service', 'excursions', 'Premium Excursions & Activities', 'Culture, music and new experiences outside the home.', 'Museums, concerts and theater\nWorkshops and cultural outings\nRestaurant trips', 'Museum visits, concerts, theater, cultural outings, workshops, restaurant trips and personalized recreational experiences.', ''],
  ['Service', 'pilates', 'Personal Pilates & Wellness', 'Gentle, low-impact movement led by qualified instructors.', 'Private and chair Pilates\nBeginner stretching and relaxation\nSmall-group sessions', 'Private Pilates, chair Pilates, beginner stretching, small-group sessions, relaxation and low-impact movement with qualified providers. Screening and any needed medical clearance come first. This is a wellness activity, not physical therapy or medical rehabilitation.', ''],
  ['Service', 'entertainment', 'Premium Entertainment Upgrade', 'More of the shows, music and fun each resident loves.', 'Premium streaming and music subscriptions\nUpgraded in-room entertainment\nMovie nights, karaoke and special performances', 'Premium streaming, upgraded in-room entertainment, music subscriptions, gaming, movie experiences, karaoke, personalized entertainment and special performances.', 'img/rooms/living.jpg'],
  ['Service', 'more', 'Additional Optional Services', 'Small touches that make every day feel personal.', 'Beauty and grooming\nPersonal shopping and specialty garment care\nBirthday and anniversary packages, guest dining\nPersonal technology assistance\nPrivate-room upgrades, where available', 'Beauty and grooming, premium private-room upgrades where available, personal shopping, specialty garment care, birthday and anniversary packages, guest dining and personal technology assistance.', 'img/rooms/main-bedroom.jpg'],
  ['Package', 'comfort-plus', 'Comfort Plus', 'Entertainment, family technology help and selected lifestyle benefits.', 'Premium entertainment\nFamily technology concierge\nSelected lifestyle benefits', 'An optional lifestyle package. Inclusions and frequency are set in your written agreement. Baseline care never requires a package.', ''],
  ['Package', 'signature-living', 'Signature Living', 'Signature dining, family concierge, activities and grooming.', 'Signature dining\nFamily connection concierge\nActivities and selected grooming benefits', 'An optional lifestyle package. Inclusions and frequency are set in your written agreement. Baseline care never requires a package.', ''],
  ['Package', 'residence-elite', 'Residence Elite', 'Our fullest lifestyle package, with an eligible room upgrade.', 'Eligible room upgrade\nEnhanced concierge\nSelected wellness and entertainment experiences', 'An optional lifestyle package. Inclusions and frequency are set in your written agreement. Baseline care never requires a package. Room upgrades depend on availability.', '']
];

/* ---------- Setup ---------- */
function setup() {
  var ss = book();
  Object.keys(COLS).forEach(function (name) { ensureTab(ss, name, COLS[name]); });
  var set = ss.getSheetByName(T.SET) || ss.insertSheet(T.SET);
  if (set.getLastRow() === 0) {
    set.getRange(1, 1, 1, 2).setValues([['Setting', 'Value']]).setFontWeight('bold').setBackground('#EBDFD1');
    set.getRange(2, 1, DEFAULT_SETTINGS.length, 2).setValues(DEFAULT_SETTINGS).setWrap(true);
    set.setColumnWidth(1, 300); set.setColumnWidth(2, 600); set.setFrozenRows(1);
  } else {
    var have = set.getRange(1, 1, set.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
    DEFAULT_SETTINGS.forEach(function (row) { if (have.indexOf(row[0]) < 0) set.appendRow(row); });
    var ack = have.indexOf('Template: acknowledgment'); // replace the older wording if it was never customised
    if (ack > -1 && /This is not yet a confirmed tour/.test(set.getRange(ack + 1, 2).getValue())) set.getRange(ack + 1, 2).setValue(DEFAULT_SETTINGS[8][1]);
  }
  var svc = ss.getSheetByName(T.SVC);
  if (svc.getLastRow() === 1) {
    svc.getRange(2, 1, SERVICES.length, COLS[T.SVC].length).setValues(SERVICES.map(function (s) {
      return [false, false, false, false, false, s[0], s[1], s[2], s[3], s[4], s[5], s[6], '', ''];
    }));
  }
  var occ = ss.getSheetByName(T.OCC);
  if (occ.getLastRow() === 1) {
    occ.getRange(2, 1, 4, 3).setValues([['Main bedroom', 'Private', false], ['Bedroom two', 'Private', false],
      ['Bedroom three', 'Private', false], ['Bedroom four', 'Private', false]]);
    occ.getRange(7, 1, 1, 2).setValues([['Licensed capacity (from permit)', '']]).setFontWeight('bold');
  }
  // Drop-downs and checkboxes
  var inq = ss.getSheetByName(T.INQ);
  list(inq, 'Status', INQ_STATUS);
  ['Room suitability review', 'Licensed capacity verification', 'Admission eligibility review'].forEach(function (h) { list(inq, h, REVIEW); });
  list(inq, 'Private financial consultation', ['Pending', 'Scheduled', 'Completed', 'Not needed']);
  var tours = ss.getSheetByName(T.TOURS);
  list(tours, 'Tour status', ['Requested', 'Approved', 'Proposed new time', 'Scheduled', 'Completed', 'Cancelled', 'No-show', 'Not offered (budget)']);
  list(tours, 'Action', ['', 'Approve & send confirmation', 'Propose new time', 'Request more information', 'Discuss alternative placement']);
  checks(ss.getSheetByName(T.TASKS), ['Done']);
  var adm = ss.getSheetByName(T.ADM);
  checks(adm, COLS[T.ADM].slice(3, 18));
  list(adm, 'Decision', ['Pending', 'Approved for admission', 'Waitlisted', 'Not approved', 'Withdrawn']);
  checks(occ, ['Verified vacant']);
  list(occ, 'Move-in status', ['Vacant', 'Reserved', 'Move-in scheduled', 'Occupied', 'Not available']);
  checks(svc, COLS[T.SVC].slice(0, 5));
  list(svc, 'Type', ['Service', 'Package']);
  var req = ss.getSheetByName(T.REQ);
  list(req, 'Status', ['Requested', 'Reviewing', 'Quote prepared', 'Quote sent privately', 'Authorized', 'Scheduled', 'Fulfilled', 'Declined', 'Closed']);
  checks(req, ['Written charges & terms provided', 'Authorized by resident/representative', 'Fulfilled', 'Billed', 'Acknowledgment recorded']);
  list(ss.getSheetByName(T.PRICE), 'Category', ['Residential rate', 'Respite rate', 'Room upgrade', 'Premium service', 'Package', 'Deposit', 'Additional charge']);
  var price = ss.getSheetByName(T.PRICE);
  var m = COLS[T.PRICE].indexOf('Contribution margin') + 1;
  price.getRange(2, m, 300, 1).setFormulaR1C1('=IF(OR(R[0]C3="",R[0]C6=""),"",R[0]C3-R[0]C6)');
  buildStats(ss);
  // Owner-only edit on confidential tabs (editors you share the Sheet with can still view unless you also restrict sharing).
  [T.PRICE, T.LOG, T.SET].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    var p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || sh.protect();
    p.setDescription('Owner only').removeEditors(p.getEditors()); if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  ss.getSheetByName(T.PRICE).setTabColor('#8A6E5A');
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0) ss.deleteSheet(blank);
  // Triggers: audit log + admin actions on edit, daily tour reminders
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onAdminEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(9).create();
  Logger.log('Your admin Sheet: ' + ss.getUrl());
}

function ensureTab(ss, name, head) {
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  var cur = s.getLastColumn() ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0] : [];
  if (cur.length && cur[0] && cur[0] !== head[0]) { // an older layout: keep it, start fresh beside it
    s.setName(name + ' (old ' + Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd') + ')');
    s = ss.insertSheet(name); cur = [];
  }
  head.forEach(function (h) { if (cur.indexOf(h) < 0) { cur.push(h); } });
  s.getRange(1, 1, 1, cur.length).setValues([cur]).setFontWeight('bold').setBackground('#EBDFD1')
    .setFontColor('#3A2E28').setWrap(true).setVerticalAlignment('top');
  s.setFrozenRows(1);
  return s;
}
function col(s, h) { var i = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].indexOf(h); return i + 1; }
function list(s, h, vals) {
  s.getRange(2, col(s, h), 999, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build());
}
function checks(s, hs) { hs.forEach(function (h) { s.getRange(2, col(s, h), 999, 1).insertCheckboxes(); }); }

function letter(tab, h) {
  var n = COLS[tab].indexOf(h) + 1, out = '';
  while (n > 0) { var m = (n - 1) % 26; out = String.fromCharCode(65 + m) + out; n = Math.floor((n - 1) / 26); }
  return out;
}
function buildStats(ss) {
  var s = ss.getSheetByName(T.STATS) || ss.insertSheet(T.STATS);
  s.clear();
  var I = function (h) { var L = letter(T.INQ, h); return "Inquiries!" + L + "2:" + L; };
  var R = function (h) { var L = letter(T.REQ, h); return "'Service requests'!" + L + "2:" + L; };
  var TS = "Tours!" + letter(T.TOURS, 'Tour status') + "2:" + letter(T.TOURS, 'Tour status');
  var rows = [['Measure', 'Value'], ['Total inquiries', '=COUNTA(' + I('Inquiry ID') + ')'],
    ['Urgent inquiries', '=COUNTIF(' + I('Urgent') + ',"Yes")']];
  INQ_STATUS.forEach(function (st) { rows.push(['Status: ' + st, '=COUNTIF(' + I('Status') + ',"' + st + '")']); });
  rows.push(['Source: Google', '=COUNTIF(' + I('Source') + ',"*google*")'],
    ['Source: Facebook / Instagram', '=COUNTIF(' + I('Source') + ',"*facebook*")+COUNTIF(' + I('Source') + ',"*instagram*")'],
    ['Source: direct or other', '=B2-SUMPRODUCT(--(ISNUMBER(SEARCH("google",' + I('Source') + '))+ISNUMBER(SEARCH("facebook",' + I('Source') + '))+ISNUMBER(SEARCH("instagram",' + I('Source') + '))>0))'],
    ['Tours scheduled', '=COUNTIF(' + TS + ',"Scheduled")'], ['Tours completed', '=COUNTIF(' + TS + ',"Completed")'],
    ['Admitted', '=COUNTIF(' + I('Status') + ',"Admitted")'],
    ['Verified vacant rooms', '=COUNTIF(Occupancy!C2:C5,TRUE)'], ['Occupied rooms', '=COUNTIF(Occupancy!E2:E5,"Occupied")'],
    ['Premium interest (Yes or Maybe)', '=COUNTIF(' + I('Premium services interest') + ',"Yes")+COUNTIF(' + I('Premium services interest') + ',"Maybe")'],
    ['Service requests', '=COUNTA(' + R('Request ID') + ')']);
  var rev = rows.length + 1;
  rows.push(['Premium revenue (fulfilled)', '=SUMIFS(' + R('Quote (private)') + ',' + R('Fulfilled') + ',TRUE)'],
    ['Premium direct cost (fulfilled)', '=SUMIFS(' + R('Direct cost (private)') + ',' + R('Fulfilled') + ',TRUE)'],
    ['Premium contribution margin', '=B' + rev + '-B' + (rev + 1)]);
  s.getRange(1, 1, rows.length, 2).setValues(rows);
  s.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#EBDFD1');
  s.setColumnWidth(1, 300);
}

/* ---------- Public endpoints ---------- */
function doGet(e) {
  // Public catalog: only services the administrator has fully enabled. No prices, ever.
  var s = book().getSheetByName(T.SVC);
  var out = [];
  if (s && s.getLastRow() > 1) {
    var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues(), h = v.shift();
    var ix = function (n) { return h.indexOf(n); };
    v.forEach(function (r) {
      if (r[0] === true && r[1] === true && r[2] === true && r[3] === true && r[4] === true && r[ix('Name')]) {
        out.push({ type: r[ix('Type')], key: r[ix('Key')], name: r[ix('Name')], description: r[ix('Short description')],
          benefits: String(r[ix('Benefits (one per line)')]).split('\n').filter(String), more: r[ix('Learn more')], image: r[ix('Image')] });
      }
    });
  }
  return json({ ok: true, services: out });
}

function doPost(e) {
  var d;
  try { d = JSON.parse((e && e.parameter && e.parameter.payload) || '{}'); } catch (err) { return json({ ok: false, error: 'bad_request' }); }
  if (d.website) return json({ ok: true, id: 'AR-0' }); // spam trap: pretend success
  var cache = CacheService.getScriptCache();
  if (d.token) { var seen = cache.get('tok:' + d.token); if (seen) return json({ ok: true, id: seen, duplicate: true }); }
  var minute = 'rate:' + Math.floor(Date.now() / 60000), n = Number(cache.get(minute) || 0);
  if (n >= Number(setting('Max website submissions per minute') || 20)) return json({ ok: false, error: 'busy' });
  cache.put(minute, String(n + 1), 120);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var r = d.kind === 'service' ? saveServiceRequest(d) : saveInquiry(d);
    if (r.ok && d.token) cache.put('tok:' + d.token, r.id, 21600);
    return json(r);
  } finally { lock.releaseLock(); }
}

/* ---------- Tour inquiries ---------- */
function clean(v, max) { return v == null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 300); }
function cleanList(v) { return (Array.isArray(v) ? v : []).map(function (x) { return clean(x, 80); }).join(', '); }

function saveInquiry(d) {
  var a = d.answers || {};
  var req = ['submitter', 'residentName', 'residentAge', 'phone', 'placement', 'timing', 'mobility', 'meds', 'nursing',
    'memory', 'funding', 'understandPrivatePay', 'income'];
  for (var i = 0; i < req.length; i++) if (!clean(a[req[i]])) return { ok: false, error: 'missing_' + req[i] };
  if (clean(a.phone).replace(/\D/g, '').length < 10) return { ok: false, error: 'phone' };
  if (a.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) return { ok: false, error: 'email' };
  if (d.consent !== true) return { ok: false, error: 'consent' };

  var ss = book(), inq = ss.getSheetByName(T.INQ);
  if (!inq) { setup(); inq = ss.getSheetByName(T.INQ); }
  var now = new Date(), id = 'AR-' + Utilities.formatDate(now, 'America/New_York', 'yyMMdd') + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();
  var couple = /spouse|partner/i.test(a.occupancy || ''), rel = couple ? (/spouse/i.test(a.occupancy) ? 'Spouse' : 'Partner') : '';
  var room = !couple ? 'Individual' : /share/.test(a.roomPref) ? 'Shared' : /separate/.test(a.roomPref) ? 'Separate' : 'Undecided';
  var flags = [], urgent = a.timing === 'Within 7 days';
  var lowBudget = ['Under $1,000', '$1,000–$1,499', '$1,500–$1,999'].indexOf(a.income) > -1;
  if (lowBudget) { flags.push('Monthly budget under $2,000 — tour calendar not offered'); urgent = false; }
  if (urgent) flags.push('URGENT: move-in within 7 days');
  if (a.placement === 'Respite stay') flags.push('Respite: confirm dates ' + clean(a.respiteStart) + ' to ' + clean(a.respiteEnd));
  if (a.placement === 'Housing only') flags.push('Housing only requested — clarify PCH services and placement expectations');
  if (/Wheelchair|transfers/.test(a.mobility)) flags.push('Individualized mobility, evacuation and accommodation review');
  if (a.nursing === 'Yes') flags.push('Continuous nursing — PCH care-scope review');
  if (/Memory|Overnight|Both/.test(a.memory)) flags.push('Memory/overnight supervision — safety and staffing review');
  if (a.funding === 'Family sponsor') flags.push('Family sponsor — confirm sponsor and payment discussion');
  if (a.funding === 'Long-term care insurance with private funds') flags.push('Long-term care insurance — reimbursement/payment discussion');
  if (a.funding === 'Government-funded placement only') flags.push('Government-funded placement only — financial follow-up (do not reject automatically)');
  if (a.understandPrivatePay === 'Need clarification') flags.push('Needs private-pay clarification');
  if (couple) {
    flags.push('Couple inquiry — route financial arrangements to a private administrator consultation');
    flags.push('Verify ' + rel.toLowerCase() + ' admission eligibility and occupancy under the PCH license');
    if (room === 'Shared') flags.push('Shared room — verify room size, permitted occupancy, privacy, fire safety and licensed capacity (never auto-approve)');
    if (room === 'Separate') flags.push('Separate rooms — two-room availability review');
    if (/Yes, both|Unsure/.test(a.bothCare)) flags.push('Separate care assessment and admission record for the ' + rel.toLowerCase());
    if (a.partnerAge === 'Under 18') flags.push(rel + ' listed as under 18 — review before proceeding');
  }
  if (/Yes|Maybe/.test(a.premiumInterest)) flags.push('Premium services interest — follow up: ' + cleanList(a.premiumCats));
  if (d.elapsed && d.elapsed < 15000) flags.push('Submitted very quickly — check for spam');
  // Possible duplicate: same phone in the last 14 days
  var phoneDigits = clean(a.phone).replace(/\D/g, '').slice(-10);
  if (inq.getLastRow() > 1) {
    var data = inq.getRange(2, 1, inq.getLastRow() - 1, inq.getLastColumn()).getValues(), pc = col(inq, 'Phone') - 1, rc = col(inq, 'Received') - 1;
    data.forEach(function (r) {
      if (String(r[pc]).replace(/\D/g, '').slice(-10) === phoneDigits && now - new Date(r[rc]) < 14 * 864e5) flags.push('Possible duplicate of ' + r[0]);
    });
  }
  var row = {
    'Inquiry ID': id, 'Received': now, 'Status': lowBudget ? 'Closed' : 'New Inquiry', 'Urgent': urgent ? 'Yes' : '', 'Flags for review': flags.join('\n'),
    'Source': clean(d.source, 200), 'Submitted by': clean(a.submitter), 'Resident name': clean(a.residentName, 120),
    'Resident age': clean(a.residentAge, 5), 'Contact name': clean(a.contactName || a.residentName, 120),
    'Relationship to resident': clean(a.relationship || (a.submitter === 'Resident' ? 'Self' : ''), 120),
    'Phone': clean(a.phone, 30), 'Email': clean(a.email, 160), 'Contact consent': 'Yes', 'Reminder consent': d.reminders ? 'Yes' : 'No',
    'Occupancy request': couple ? 'Couple' : (a.occupancy === 'Unsure at this time' ? 'Unsure' : 'Individual'),
    'Spouse/partner relationship': rel, 'Room preference': room, 'Number of prospective occupants': couple ? 2 : 1,
    'Spouse/partner care needs': couple ? clean(a.bothCare) : '', 'Spouse/partner age': couple ? clean(a.partnerAge) : '',
    'Spouse/partner move-in': couple ? clean(a.partnerMoveIn) : '', 'Placement type': clean(a.placement),
    'Respite arrival': clean(a.respiteStart, 20), 'Respite departure': clean(a.respiteEnd, 20),
    'Housing-only follow-up': clean(a.housingOnly), 'Current living arrangement': clean(a.living), 'Move-in timeframe': clean(a.timing),
    'Daily-living help': cleanList(a.adl), 'Mobility': clean(a.mobility), 'Medication assistance': clean(a.meds),
    'Continuous skilled nursing': clean(a.nursing), 'Memory / overnight supervision': clean(a.memory),
    'Accessibility & other considerations': clean(a.accessibility, 1000), 'Funding': clean(a.funding),
    'Sponsor relationship': clean(a.sponsorRel, 120), 'Sponsor will discuss payment': clean(a.sponsorDiscuss),
    'Monthly income (approx.)': clean(a.income), 'Family or sponsor contribution': clean(a.familyContrib),
    'Payment coordinator': clean(a.payCoordinator, 120), 'Wants private-pay discussion': clean(a.discussAdmin),
    'Understands private pay': clean(a.understandPrivatePay), 'Resident interested': clean(a.residentInterested),
    'Tour attendees': clean(a.attendees, 200), 'Preferred tour date': clean(a.tourDate, 20), 'Preferred tour window': clean(a.tourWindow),
    'Premium services interest': clean(a.premiumInterest), 'Premium categories': cleanList(a.premiumCats),
    'Additional questions': clean(a.questions, 1500),
    'Room suitability review': 'Pending', 'Licensed capacity verification': 'Pending', 'Admission eligibility review': 'Pending',
    'Private financial consultation': (couple || a.discussAdmin === 'Yes' || a.understandPrivatePay !== 'Yes' || /Government|insurance|sponsor/i.test(a.funding)) ? 'Pending' : 'Not needed',
    'Last updated': now
  };
  appendObj(inq, row);
  appendObj(ss.getSheetByName(T.TOURS), { 'Inquiry ID': id, 'Contact name': row['Contact name'], 'Phone': row.Phone, 'Email': row.Email,
    'Reminder consent': row['Reminder consent'], 'Requested date': row['Preferred tour date'], 'Requested window': row['Preferred tour window'], 'Tour status': lowBudget ? 'Not offered (budget)' : 'Requested' });
  if (!lowBudget) task('Tour request', id, 'Review inquiry and approve, propose a time, request information or discuss alternative placement' + (urgent ? ' (URGENT)' : ''), urgent ? 0 : 1);
  if (/Yes|Maybe/.test(a.premiumInterest)) task('Premium interest', id, 'Follow up on premium services: ' + (row['Premium categories'] || 'general'), 3);
  // Admin email: no health, care or financial details.
  mail(setting('Admin notification email'), (urgent ? 'URGENT — ' : '') + 'New tour inquiry ' + id,
    'A new tour inquiry was received (' + id + ').\nItems flagged for review: ' + flags.length +
    '\n\nOpen the admin Sheet to see the details:\n' + ss.getUrl());
  if (row.Email && !lowBudget && /^y/i.test(setting('Send applicant acknowledgment'))) {
    mail(row.Email, 'We received your tour request — ' + setting('Business name'), fill(setting('Template: acknowledgment'), { id: id }));
  }
  return { ok: true, id: id, tourEligible: !lowBudget };
}

/* ---------- Optional service information requests ---------- */
function saveServiceRequest(d) {
  var a = d.answers || {};
  if (!clean(a.name) || clean(a.phone).replace(/\D/g, '').length < 10 || !clean(a.service)) return { ok: false, error: 'missing' };
  if (a.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) return { ok: false, error: 'email' };
  if (d.consent !== true) return { ok: false, error: 'consent' };
  var ss = book(), now = new Date(), id = 'SR-' + Utilities.formatDate(now, 'America/New_York', 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  appendObj(ss.getSheetByName(T.REQ), { 'Request ID': id, 'Received': now, 'Status': 'Requested', 'Service': clean(a.service, 120),
    'Name': clean(a.name, 120), 'Phone': clean(a.phone, 30), 'Email': clean(a.email, 160), 'Message': clean(a.message, 1000), 'Contact consent': 'Yes' });
  task('Service information request', id, 'Review needs and availability; prepare a private quote if appropriate', 2);
  mail(setting('Admin notification email'), 'New service information request ' + id, 'A visitor asked about an optional service (' + id + ').\n\nOpen the admin Sheet:\n' + ss.getUrl());
  if (clean(a.email) && /^y/i.test(setting('Send applicant acknowledgment'))) {
    mail(clean(a.email), 'We received your request — ' + setting('Business name'), fill(setting('Template: service request received'), { id: id, service: clean(a.service, 120) }));
  }
  return { ok: true, id: id };
}

/* ---------- Administrator actions (installable on-edit trigger) ---------- */
function onAdminEdit(e) {
  if (!e || !e.range) return;
  var s = e.range.getSheet(), name = s.getName(), ss = s.getParent();
  if (name !== T.LOG && e.range.getRow() > 1) {
    var who = (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || 'unknown';
    ss.getSheetByName(T.LOG).appendRow([new Date(), who, name, e.range.getA1Notation(),
      e.oldValue == null ? '' : e.oldValue, e.value == null ? (e.range.getNumRows() > 1 ? '(multiple cells)' : e.range.getValue()) : e.value]);
  }
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1 || e.range.getRow() < 2) return;
  var r = e.range.getRow(), header = s.getRange(1, e.range.getColumn()).getValue();
  var get = function (h) { return s.getRange(r, col(s, h)).getValue(); }, put = function (h, v) { s.getRange(r, col(s, h)).setValue(v); };

  if (name === T.INQ && header === 'Status') {
    put('Last updated', new Date());
    if (e.value === 'Admission Review') {
      var adm = ss.getSheetByName(T.ADM), ids = adm.getLastRow() > 1 ? adm.getRange(2, 1, adm.getLastRow() - 1, 1).getValues().map(String) : [];
      if (ids.indexOf(String(get('Inquiry ID'))) < 0) appendObj(adm, { 'Inquiry ID': get('Inquiry ID'), 'Resident name': get('Resident name'), 'Opened': new Date(), 'Decision': 'Pending' });
      task('Admission screening', get('Inquiry ID'), 'Complete the admission checklist on the Admissions tab', 7);
    }
  }

  if (name === T.TOURS && header === 'Action' && e.value) {
    var id = get('Inquiry ID'), email = get('Email'), date = get('Confirmed date'), time = get('Confirmed time');
    if (time instanceof Date) time = Utilities.formatDate(time, 'America/New_York', 'h:mm a');
    var dstr = date instanceof Date ? Utilities.formatDate(date, 'America/New_York', 'EEEE, MMMM d') : String(date);
    var needsTime = /Approve|Propose/.test(e.value);
    if (needsTime && (!date || !time)) { put('Action', ''); put('Notes', 'Fill in Confirmed date and Confirmed time first, then choose the action again.'); return; }
    if (/Approve/.test(e.value)) {
      var clash = findClash(s, r, date, time);
      if (clash) { put('Action', ''); put('Notes', 'Not sent: ' + clash + ' already has a tour at that time.'); return; }
    }
    var key = { 'Approve & send confirmation': 'Template: tour confirmation', 'Propose new time': 'Template: propose new time',
      'Request more information': 'Template: request information', 'Discuss alternative placement': 'Template: discuss alternative placement' }[e.value];
    var sent = email ? mail(email, setting('Business name') + ' — your tour request ' + id, fill(setting(key), { id: id, date: dstr, time: time })) : false;
    put('Action sent', (sent ? 'Emailed: ' : 'No email on file — call instead: ') + e.value + ' (' + Utilities.formatDate(new Date(), 'America/New_York', 'MMM d h:mm a') + ')');
    if (/Approve/.test(e.value)) { put('Tour status', 'Scheduled'); setInquiryStatus(ss, id, 'Tour Scheduled'); }
    if (/Propose/.test(e.value)) put('Tour status', 'Proposed new time');
    if (/Request more/.test(e.value)) setInquiryStatus(ss, id, 'Needs Follow-Up');
    put('Action', '');
  }

  if (name === T.REQ && header === 'Billed' && e.value === 'TRUE' && get('Authorized by resident/representative') !== true) {
    put('Billed', false); put('Notes', 'Not billed: record the resident/representative authorization first.');
  }
}

function findClash(s, row, date, time) {
  var v = s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues(), h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  var d = h.indexOf('Confirmed date'), t = h.indexOf('Confirmed time'), st = h.indexOf('Tour status'), key = String(date) + '|' + String(time);
  for (var i = 0; i < v.length; i++) {
    if (i + 2 === row) continue;
    if (String(v[i][d]) + '|' + String(v[i][t]) === key && v[i][st] === 'Scheduled') return v[i][0];
  }
  return '';
}
function setInquiryStatus(ss, id, status) {
  var s = ss.getSheetByName(T.INQ), ids = s.getRange(2, 1, Math.max(s.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) {
    s.getRange(i + 2, col(s, 'Status')).setValue(status); s.getRange(i + 2, col(s, 'Last updated')).setValue(new Date());
  }
}

/* ---------- Daily tour reminders (only with reminder consent) ---------- */
function sendReminders() {
  if (!/^y/i.test(setting('Send tour reminders (day before)'))) return;
  var s = book().getSheetByName(T.TOURS); if (s.getLastRow() < 2) return;
  var h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0], v = s.getRange(2, 1, s.getLastRow() - 1, h.length).getValues();
  var tz = 'America/New_York', tomorrow = Utilities.formatDate(new Date(Date.now() + 864e5), tz, 'yyyy-MM-dd');
  v.forEach(function (r, i) {
    var o = {}; h.forEach(function (k, j) { o[k] = r[j]; });
    if (o['Tour status'] !== 'Scheduled' || o['Reminder consent'] !== 'Yes' || o['Reminder sent'] || !o.Email || !(o['Confirmed date'] instanceof Date)) return;
    if (Utilities.formatDate(o['Confirmed date'], tz, 'yyyy-MM-dd') !== tomorrow) return;
    mail(o.Email, 'Tour reminder — ' + setting('Business name'), fill(setting('Template: tour reminder'),
      { id: o['Inquiry ID'], date: Utilities.formatDate(o['Confirmed date'], tz, 'EEEE, MMMM d'), time: o['Confirmed time'] instanceof Date ? Utilities.formatDate(o['Confirmed time'], tz, 'h:mm a') : o['Confirmed time'] }));
    s.getRange(i + 2, h.indexOf('Reminder sent') + 1).setValue(new Date());
  });
}

/* ---------- Helpers ---------- */
function appendObj(s, o) {
  var h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  s.appendRow(h.map(function (k) { return o[k] == null ? '' : o[k]; }));
}
function task(type, ref, text, dueDays) {
  appendObj(book().getSheetByName(T.TASKS), { 'Created': new Date(), 'Type': type, 'Reference ID': ref, 'Task': text,
    'Due': new Date(Date.now() + dueDays * 864e5), 'Done': false });
}
var _settings;
function setting(k) {
  if (!_settings) {
    _settings = {}; var s = book().getSheetByName(T.SET);
    if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function (r) { _settings[r[0]] = r[1]; });
    DEFAULT_SETTINGS.forEach(function (r) { if (_settings[r[0]] == null || _settings[r[0]] === '') _settings[r[0]] = r[1]; });
  }
  return _settings[k];
}
function fill(t, vals) {
  vals.business = setting('Business name'); vals.phone = setting('Business phone');
  return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return vals[k] == null ? '' : vals[k]; });
}
function mail(to, subject, body) {
  if (!to) return false;
  try { MailApp.sendEmail({ to: String(to), subject: subject, body: body, name: setting('Business name') }); return true; }
  catch (err) { Logger.log('Mail failed: ' + err); return false; }
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Finds the admin Sheet. If this Google account cannot open the shared one,
   it makes its own "The Abernathy Residence — Tour Inquiries" Sheet and remembers it. */
function book() {
  var bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  var props = PropertiesService.getScriptProperties();
  var ids = [props.getProperty('SHEET_ID'), SHEET_ID];
  for (var i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    try { return SpreadsheetApp.openById(ids[i]); } catch (err) {}
  }
  var made = SpreadsheetApp.create('The Abernathy Residence — Tour Inquiries');
  props.setProperty('SHEET_ID', made.getId());
  return made;
}
