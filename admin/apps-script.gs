/**
 * The Abernathy Residence — tour inquiry inbox (Google Apps Script).
 * Works from the Sheet's Extensions > Apps Script or from script.google.com. Run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */
var SHEET_ID = '1slor0dhnt_Jyma6WbZ3G8Xbj6yI28C8e4CdFnU2RoaY'; // The Abernathy Residence — Tour Inquiries
var NOTIFY_EMAIL = 'info@theabernathyresidence.com'; // who gets an email for each new inquiry
var INQUIRIES = 'Inquiries';
var ASSESSMENTS = 'Care assessments';

var HEAD = ['Received', 'Status', 'Name', 'Phone', 'Email', 'Best way to reach', 'Filled out by',
  'Resident first name', 'Resident age', 'Occupancy request', 'Relationship', 'Room preference',
  'Number of prospective occupants', 'Care needs — resident', 'Care needs — spouse/partner',
  'Spouse/partner age', 'Proposed move-in — resident', 'Proposed move-in — spouse/partner',
  'Mobility', 'Ongoing nursing need', 'Payment sources', 'Able to pay privately', 'Package interest',
  'Notes', 'Flags for review', 'Room suitability review', 'Licensed capacity verification',
  'Admission eligibility review', 'Private financial consultation', 'Admin notes'];
var A_HEAD = ['Received', 'Inquiry contact', 'Phone', 'Occupant', 'Age', 'Care needs', 'Mobility',
  'Ongoing nursing need', 'Assessment status', 'Assessment date', 'Admission record', 'Admin notes'];

var STATUS = ['New', 'Contacted', 'Tour booked', 'Toured', 'Assessment scheduled', 'Admitted', 'Not a fit', 'Closed'];
var REVIEW = ['Pending', 'Approved', 'Not approved', 'Not needed'];
var CONSULT = ['Pending', 'Scheduled', 'Completed', 'Not needed'];
var ASSESS = ['Pending', 'Scheduled', 'Completed', 'Not eligible'];

function setup() {
  var ss = book();
  var s = ss.getSheetByName(INQUIRIES) || ss.insertSheet(INQUIRIES);
  prep(s, HEAD);
  rule(s, HEAD.indexOf('Status') + 1, STATUS);
  ['Room suitability review', 'Licensed capacity verification', 'Admission eligibility review']
    .forEach(function (h) { rule(s, HEAD.indexOf(h) + 1, REVIEW); });
  rule(s, HEAD.indexOf('Private financial consultation') + 1, CONSULT);
  var a = ss.getSheetByName(ASSESSMENTS) || ss.insertSheet(ASSESSMENTS);
  prep(a, A_HEAD);
  rule(a, A_HEAD.indexOf('Assessment status') + 1, ASSESS);
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(blank);
}

function prep(s, head) {
  s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold')
    .setBackground('#EBDFD1').setFontColor('#3A2E28').setWrap(true);
  s.setFrozenRows(1);
  s.setFrozenColumns(3);
}

function rule(s, col, list) {
  s.getRange(2, col, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build());
}

function doPost(e) {
  var d = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
  if (d.website) return out('ok'); // spam trap
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = book();
    if (!ss.getSheetByName(INQUIRIES)) setup();
    var c = d.contact || {};
    var couple = /spouse|partner/.test(d.occupancy || '');
    var rel = couple ? (/spouse/.test(d.occupancy) ? 'Spouse' : 'Partner') : '';
    var room = !couple ? 'Individual' : /share one room/.test(d.roomPref) ? 'Shared' :
      /separate/.test(d.roomPref) ? 'Separate' : 'Undecided';
    var occupants = couple ? '2' : (/Unsure/.test(d.occupancy || '') ? '1 (may be 2 — unsure)' : '1');
    var partnerCare = !couple ? '' : /Yes, both/.test(d.bothCare) ? 'Needs personal care — assessment required' :
      /Unsure/.test(d.bothCare) ? 'Unsure — assessment requested' : 'No personal care requested';
    var help = (d.help || []).join(', ');
    var flags = [], pending = function (yes) { return yes ? 'Pending' : 'Not needed'; };

    if (couple) {
      flags.push('Couple inquiry — route all financial arrangements to a private administrator consultation');
      flags.push('Verify ' + rel.toLowerCase() + ' admission eligibility and that their occupancy is permitted under the PCH license');
      if (room === 'Shared') flags.push('Shared room requested — verify room size, permitted occupancy, resident privacy, fire safety and licensed capacity before any approval');
      if (room === 'Separate') flags.push('Separate rooms requested — two-room availability review');
      if (room === 'Undecided') flags.push('Room arrangement to be discussed');
      if (/Yes, both|Unsure/.test(d.bothCare)) flags.push('Create a separate care assessment and admission record for the ' + rel.toLowerCase());
      if (d.partnerAge === 'Under 18') flags.push(rel + ' listed as under 18 — a personal care home serves adults; review before proceeding');
      if (d.partnerMoveIn === 'At a later date') flags.push(rel + ' will move in later — hold occupancy plan for review');
    }
    if (d.nursing === 'Yes') flags.push('Ongoing nursing need — confirm the home and its nursing partner can meet it');
    if (/one or more people|stays in bed/.test(d.mobility || '')) flags.push('Mobility needs — confirm safe care and evacuation');
    if (d.privatePay && d.privatePay !== 'Yes') flags.push('Private-pay ability to be discussed');

    var row = {
      'Received': new Date(), 'Status': 'New', 'Name': c.name, 'Phone': c.phone, 'Email': c.email,
      'Best way to reach': c.prefer, 'Filled out by': d.filler, 'Resident first name': c.residentName,
      'Resident age': d.age, 'Occupancy request': couple ? 'Couple' : 'Individual', 'Relationship': rel,
      'Room preference': room, 'Number of prospective occupants': occupants,
      'Care needs — resident': help, 'Care needs — spouse/partner': partnerCare,
      'Spouse/partner age': d.partnerAge || '', 'Proposed move-in — resident': d.timing,
      'Proposed move-in — spouse/partner': couple ? d.partnerMoveIn : '', 'Mobility': d.mobility,
      'Ongoing nursing need': d.nursing, 'Payment sources': (d.payment || []).join(', '),
      'Able to pay privately': d.privatePay, 'Package interest': d.package, 'Notes': c.notes,
      'Flags for review': flags.join('\n'),
      'Room suitability review': pending(couple), 'Licensed capacity verification': 'Pending',
      'Admission eligibility review': 'Pending',
      'Private financial consultation': pending(couple || d.privatePay !== 'Yes'), 'Admin notes': ''
    };
    ss.getSheetByName(INQUIRIES).appendRow(HEAD.map(function (h) { return row[h] == null ? '' : row[h]; }));

    var as = ss.getSheetByName(ASSESSMENTS), now = new Date();
    as.appendRow([now, c.name, c.phone, 'Primary resident' + (c.residentName ? ' (' + c.residentName + ')' : ''),
      d.age, help, d.mobility, d.nursing, 'Pending', '', 'Not started', '']);
    if (couple && /Yes, both|Unsure/.test(d.bothCare)) {
      as.appendRow([now, c.name, c.phone, rel, d.partnerAge, 'To be assessed', '', '', 'Pending', '', 'Not started', '']);
    }

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'New tour inquiry: ' + (c.name || 'website visitor') + (couple ? ' (couple)' : ''),
        body: 'Name: ' + c.name + '\nPhone: ' + c.phone + '\nEmail: ' + (c.email || '-') +
          '\nBest way to reach: ' + c.prefer + '\nOccupancy: ' + row['Occupancy request'] +
          (couple ? ' — ' + rel + ', room: ' + room : '') + '\nMove-in: ' + d.timing +
          '\nPackage interest: ' + d.package + (flags.length ? '\n\nFlags:\n- ' + flags.join('\n- ') : '') +
          '\n\nOpen the sheet: ' + ss.getUrl()
      });
    }
  } finally {
    lock.releaseLock();
  }
  return out('ok');
}

function book() { return SpreadsheetApp.openById(SHEET_ID); }

function out(t) { return ContentService.createTextOutput(t); }
