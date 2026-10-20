// Month view: control card like the week view, calendar-style day tiles, today marker.

(function(){
  if(!location.href.includes('PRGNAME=MONTH')) return;
  document.documentElement.classList.add('tc-month');

  var FULLDAY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Mo|Di|Mi|Do|Fr|Sa|So)/;
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var now = new Date();

  // The calendar table is the one whose header row lists the weekdays.
  var table = $(), header = $();
  $('#pageContent tr').each(function(){
    if(table.length) return;
    var cells = $(this).children('td, th');
    if(cells.filter(function(){ return FULLDAY.test($(this).text().trim()); }).length >= 5){
      header = $(this); table = $(this).closest('table');
    }
  });
  if(!table.length) return;

  var scope = $('#pageContent');
  function findLink(re){ return scope.find('a').not(table.find('a')).not('.tc-card a').filter(function(){ return re.test($(this).text().replace(/\s+/g, ' ').trim()); }).first(); }
  function proxy(src, text, cls, title){
    if(!src || !src.length) return null;
    var b = $('<a></a>').text(text).attr('href', src.attr('href') || '#');
    if(cls) b.addClass(cls);
    if(title) b.attr('title', title);
    b.on('click', function(e){ e.preventDefault(); src[0].click(); });
    return b;
  }

  // Which month is shown? Read "October 2026" from the caption or the page title.
  var caption = '', shownMonth = -1, shownYear = -1;
  scope.find('*').contents().each(function(){
    if(caption || this.nodeType !== 3) return;
    var t = this.nodeValue.trim(), m = /([A-Za-zäÄ]+)\s+(\d{4})$/.exec(t);
    if(!m) return;
    var i = MONTHS.indexOf(m[1]); if(i < 0) i = MONATE.indexOf(m[1]);
    if(i >= 0){ caption = MONTHS[i] + ' ' + m[2]; shownMonth = i; shownYear = +m[2]; }
  });
  var isCurrentMonth = shownMonth === now.getMonth() && shownYear === now.getFullYear();

  // ---- Control card ----
  var prev = scope.find('a.img_arrowLeft').first(), next = scope.find('a.img_arrowRight').first();
  var title = $('<div class="tc-week-title"></div>').append('<em class="tc-eyebrow">Schedule</em>', $('<strong></strong>').text(caption || 'Month'));
  if(isCurrentMonth) title.append($('<span></span>').text('This month'));
  var stepper = $('<div class="tc-stepper"></div>');
  [proxy(prev, '‹', 'tc-icon', 'Previous month (←)'), proxy(findLink(/^(Today|Heute)$/), 'Today', 'tc-today-btn'), proxy(next, '›', 'tc-icon', 'Next month (→)')]
    .forEach(function(b){ if(b) stepper.append(b); });
  var views = $('<div class="tc-seg tc-views"></div>');
  [[/^(Day|Tag)$/, 'Day'], [/^(Week|Woche)$/, 'Week'], [/^(Working week|Arbeitswoche)$/, 'Work week'], [/^(Month|Monat)$/, 'Month', true]]
    .forEach(function(v){ var b = proxy(findLink(v[0]), v[1]); if(b){ b.toggleClass('on', !!v[2]); views.append(b); } });
  var print = proxy(findLink(/^(Printable version|Druckversion)$/), '', 'tc-icon tc-print', 'Printable version');
  var controls = $('<div class="tc-sched-controls"></div>').append(views);
  if(print) controls.append($('<div class="tc-sched-right"></div>').append(print));
  var card = $('<div class="tc-sched-bar tc-card"></div>')
    .append($('<div class="tc-sched-top"></div>').append(title, stepper), controls);
  table.before(card);

  // Hide TUCaN's caption + navigation (kept in the page for its links), but never a
  // row that also contains the calendar itself.
  // Climb from the element to the largest ancestor that still doesn't contain the
  // calendar or our card; that block is TUCaN's caption/navigation bar.
  var hideRow = function(el){
    var node = $(el);
    if(node.closest(table).length || node.closest('.tc-card').length) return;
    while(node.parent().length && !node.parent().is(scope) &&
          !node.parent().find(table).length && !node.parent().find('.tc-card').length) node = node.parent();
    if(!node.find(table).length && !node.is('.tc-card')) node.addClass('tc-tucan-nav').hide();
  };
  [prev, next, findLink(/^(Today|Heute)$/), findLink(/^(Month|Monat)$/)].forEach(function(a){ if(a.length) hideRow(a); });
  if(caption) scope.find('td, th, div').filter(function(){ return $(this).children().length === 0 && $(this).text().trim() === caption; }).each(function(){ hideRow(this); });
  header.prevAll('tr').addClass('tc-tucan-nav').hide();

  // ---- Calendar tiles ----
  // Each day is one cell holding a small inner table (date number + entries).
  table.addClass('tc-mtable');
  table.find('table').addClass('tc-minner');
  var rows = header.add(header.nextAll('tr'));
  var grid = [], pos = new Map();
  rows.each(function(r){
    grid[r] = grid[r] || [];
    var c = 0;
    $(this).children('td, th').each(function(){
      while(grid[r][c]) c++;
      var rs = parseInt(this.getAttribute('rowspan'), 10) || 1, cs = parseInt(this.getAttribute('colspan'), 10) || 1;
      for(var i = 0; i < rs; i++){ grid[r + i] = grid[r + i] || []; for(var j = 0; j < cs; j++) grid[r + i][c + j] = this; }
      pos.set(this, {row: r, col: c});
      c += cs;
    });
  });
  var weekendCols = [];
  header.children('td, th').each(function(){ if(/^(Sat|Sun|Sa|So)/.test($(this).text().trim())) weekendCols.push(pos.get(this).col); });
  header.addClass('tc-month-head');

  rows.not(header).children('td, th').each(function(){
    var cell = $(this), p = pos.get(this);
    if(p.col === 0){ cell.addClass('tc-cw'); return; }
    if(weekendCols.indexOf(p.col) >= 0) cell.addClass('tc-weekend');
    var dateLink = cell.find('a').filter(function(){ return /^\d{1,2}$/.test($(this).text().trim()); }).first();
    if(!dateLink.length){ cell.addClass('tc-mblank'); return; }
    cell.addClass('tc-mday');
    dateLink.addClass('tc-mnum');
    dateLink.closest('td, th').not(cell).addClass('tc-mnum-cell');
    if(isCurrentMonth && +dateLink.text().trim() === now.getDate()) cell.addClass('tc-mtoday');
  });

  // Entries show "15:20 - SDM"; the title has "15:20 - 17:00 / S202/C205 / Full Name".
  table.find('a.apmntLink[title]').each(function(){
    var parts = (this.getAttribute('title') || '').split(' / ');
    var time = (/^(\d{1,2}:\d{2})/.exec(parts[0] || '') || [])[1];
    var name = parts.length > 2 ? parts[parts.length - 1].trim() : '';
    if(time && name) $(this).empty().append($('<b class="tc-mtime"></b>').text(time), document.createTextNode(' ' + name));
  });

  if(shownMonth >= 0) jumpToTodayOnArrival(isCurrentMonth, findLink(/^(Today|Heute)$/));

  $(document).on('keydown', function(e){
    if(e.altKey || e.ctrlKey || e.metaKey || $(e.target).is('input, select, textarea')) return;
    if(e.key === 'ArrowLeft' && prev.length){ e.preventDefault(); prev[0].click(); }
    if(e.key === 'ArrowRight' && next.length){ e.preventDefault(); next[0].click(); }
  });
})();
