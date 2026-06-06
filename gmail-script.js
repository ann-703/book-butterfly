var SPREADSHEET_ID = '1C0TRofH8WnhFsalVOqAnvqVjdc08UD_AdaXI4G6Q5rw';
var SHEET_NAME = 'Book Butterfly Log';
var PARENT_EMAIL = 'ankita.sayal@gmail.com';

function doPost(e) {
  var data = e.parameter;
  var rowId = logToSheet(data);
  sendEmail(data, rowId);
  return ContentService.createTextOutput('ok');
}

function logToSheet(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Date', 'Book Title', 'Author', 'Verdict', 'Confidence',
      'Reason', 'Priana Said', 'Back Cover Text',
      'What Gemini Found Online', 'Mama Override', 'Notes'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date(),
    data.book_title || '',
    data.book_author || '',
    data.verdict || '',
    data.confidence || '',
    data.butterfly_reason || '',
    data.child_feedback || '',
    data.blurb || '',
    data.search_context || '',
    '',
    ''
  ]);

  return sheet.getLastRow();
}

function sendEmail(data, rowId) {
  var verdict = data.verdict || 'UNKNOWN';
  var confidence = data.confidence || '';
  var title = data.book_title || 'a book';
  var author = data.book_author ? ' by ' + data.book_author : '';
  var label = verdict === 'GOOD' ? 'YES' : 'NOT YET';

  var subject = 'Book Butterfly: ' + label + ' - ' + title;

  var body = 'Hi Mama!\n\n'
    + 'Priana checked a book:\n\n'
    + 'BOOK: ' + title + author + '\n'
    + 'VERDICT: ' + verdict + ' (Confidence: ' + confidence + ')\n'
    + 'REASON: ' + (data.butterfly_reason || '') + '\n\n'
    + 'PRIANA SAYS: ' + (data.child_feedback || '(no message)') + '\n\n'
    + '--- WHAT BOOK BUTTERFLY FOUND ONLINE ---\n'
    + (data.search_context || '(no search data)') + '\n\n'
    + '--- BACK COVER TEXT ---\n'
    + (data.blurb || '(image only)') + '\n\n'
    + 'View full log: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit\n\n'
    + 'Love, Book Butterfly';

  GmailApp.sendEmail(PARENT_EMAIL, subject, body);
}

function testEmail() {
  var testData = {
    book_title: 'Cece Loves Science',
    book_author: 'Kimberly Derting',
    verdict: 'GOOD',
    confidence: 'HIGH',
    butterfly_reason: 'This is a fun science book perfect for curious kids!',
    child_feedback: 'I love this book!',
    blurb: 'Science experiments with Cece and her dog Einstein.',
    search_context: 'Common Sense Media rates this 5/5 for ages 4-8.'
  };
  logToSheet(testData);
  sendEmail(testData, 999);
}

function monthlyDigest() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0];
  var verdictCol = headers.indexOf('Verdict');
  var overrideCol = headers.indexOf('Mama Override');
  var titleCol = headers.indexOf('Book Title');
  var reasonCol = headers.indexOf('Reason');
  var searchCol = headers.indexOf('What Gemini Found Online');

  var disagreements = [];
  var allScans = data.length - 1;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var verdict = row[verdictCol];
    var override = row[overrideCol];
    if (override && override !== verdict) {
      disagreements.push({
        title: row[titleCol],
        verdict: verdict,
        override: override,
        reason: row[reasonCol],
        search: (row[searchCol] || '').slice(0, 300)
      });
    }
  }

  var subject = 'Book Butterfly Monthly Digest - ' + new Date().toDateString();

  var body = 'BOOK BUTTERFLY MONTHLY SUMMARY\n\n'
    + 'Total books scanned: ' + allScans + '\n'
    + 'Times Mama disagreed: ' + disagreements.length + '\n\n';

  if (disagreements.length > 0) {
    body += '--- CASES WHERE MAMA DISAGREED ---\n\n';
    disagreements.forEach(function(d) {
      body += 'Book: ' + d.title + '\n'
        + 'Book Butterfly said: ' + d.verdict + '\n'
        + 'Mama said: ' + d.override + '\n'
        + 'Reason given: ' + d.reason + '\n'
        + 'Search context: ' + d.search + '\n\n';
    });
    body += '--- ACTION NEEDED ---\n'
      + 'Review each case above and update the rules in your Book Butterfly prompt.\n\n';
  } else {
    body += 'Book Butterfly and Mama agreed on everything this month!\n\n';
  }

  body += 'Full log: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit\n\nLove, Book Butterfly';
  GmailApp.sendEmail(PARENT_EMAIL, subject, body);
}
