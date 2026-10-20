// Exam registration page: module headers with code chips, clear exam lines, status badges.

(function(){
  if(!location.href.includes('PRGNAME=EXAMREGISTRATION')) return;
  document.documentElement.classList.add('tc-exams');

  var CODE = /^(\d{2}-[a-z0-9]{2}-\d{4}(?:-[\w]+)?)$/i;
  var MONTHS = {Jan:0, Feb:1, Mar:2, 'Mär':2, Apr:3, May:4, Mai:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Okt:9, Nov:10, Dec:11, Dez:11};
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var content = $('#pageContent');
  var plain = function(el){ return $(el).text().replace(/\s+/g, ' ').trim(); };

  content.find('tr').each(function(){
    var row = $(this), cells = row.children('td');
    if(cells.length < 2) return;

    // Module header: "20-00-0947-iv | Deep Learning for NLP (20-00-0947 , 20-00-0947-iv )"
    var code = plain(cells.eq(0));
    if(CODE.test(code) && !row.find('a').length){
      row.addClass('tc-exam-module');
      cells.eq(0).empty().append($('<span class="tc-code"></span>').text(code));
      var titleCell = cells.eq(1);
      titleCell.contents().filter(function(){ return this.nodeType === 3; }).each(function(){
        this.nodeValue = this.nodeValue.replace(/\s*\((?:\s*\d{2}-[a-z0-9]{2}-\d{4}[\w-]*\s*,?\s*)+\)\s*$/i, '');
      });
      titleCell.addClass('tc-exam-title');
      return;
    }

    // Exam line
    var link = row.find('a').filter(function(){ return /Exam|Prüfung|Klausur|Date|Termin/i.test(plain(this)); }).first();
    if(!link.length) return;
    row.addClass('tc-exam-row');
    link.addClass('tc-exam-link');
    // "… 1. Date" / "… 2. Date" -> "… · 1st sitting" / "… · 2nd sitting"
    link.contents().filter(function(){ return this.nodeType === 3; }).each(function(){
      this.nodeValue = this.nodeValue
        .replace(/\s*-?\s*Sonderprüfungstermin\s*/i, ' · special date ')
        .replace(/\s*(\d)\.\s*(Date|Termin)\s*$/i, function(_, n){ return ' · ' + n + ({1:'st', 2:'nd', 3:'rd'}[n] || 'th') + ' sitting'; })
        .replace(/\s+·\s+·\s+/g, ' · ');
    });

    cells.each(function(){
      var cell = $(this), t = plain(cell);
      if(/^(Selected|Ausgewählt|Angemeldet|Registered)$/i.test(t)){
        cell.empty().append($('<span class="tc-badge tc-badge-ok"></span>').text('✓ ' + t));
        row.addClass('tc-exam-selected');
      } else if(/^(Time tbd|Termin folgt|tba|tbd)$/i.test(t)){
        cell.addClass('tc-tbd');
      } else {
        var d = /(\d{1,2})\.\s*([A-Za-zä]{3})\.?\s*(\d{4})/.exec(t);
        if(d && MONTHS[d[2]] !== undefined){
          cell.addClass('tc-exam-date');
          if(new Date(+d[3], MONTHS[d[2]], +d[1]) < today) row.addClass('tc-exam-past');
        }
      }
    });
  });

  // Register / cancel actions as buttons.
  content.find('a, input[type="submit"]').each(function(){
    var t = ($(this).text() || this.value || '').trim();
    if(/^(Register|Anmelden)$/i.test(t)) $(this).addClass('tc-btn tc-btn-go');
    else if(/^(Deregister|Abmelden|Cancel)$/i.test(t)) $(this).addClass('tc-btn tc-btn-stop');
  });
})();
