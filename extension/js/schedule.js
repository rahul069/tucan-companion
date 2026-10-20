// Schedule page: agenda view, trimmed grid, full course names, today highlight.

// Climb from an element to the largest ancestor that doesn't contain the calendar
// table or our card, and hide it (TUCaN's caption / navigation bars).
function hideBlock(els, table){
  var scope = $('#pageContent');
  if(!table || !table.length) return;  // without a known calendar table, hiding could swallow the page
  $(els).each(function(){
    var node = $(this);
    if(node.closest('.tc-card').length) return;
    if(node.closest(table).length){ node.closest('caption').hide(); return; }  // inside the calendar: only a <caption> may go
    while(node.parent().length && !node.parent().is(scope) &&
          !node.parent().find(table).length && !node.parent().find('.tc-card').length) node = node.parent();
    if(!node.find(table).length && !node.is('.tc-card')) node.addClass('tc-tucan-nav').hide();
  });
}

// If the user came from a non-schedule page and today isn't shown, open today's week/month.
function jumpToTodayOnArrival(showsToday, todayLink){
  if(showsToday || !todayLink || !todayLink.length) return;
  var ref = document.referrer || '';
  if(/PRGNAME=(SCHEDULER|MONTH)/.test(ref)) return;          // browsing within the schedule
  try{
    var last = +sessionStorage.getItem('tc-today-jump') || 0;
    if(Date.now() - last < 10000) return;                     // never loop
    sessionStorage.setItem('tc-today-jump', Date.now());
  }catch(e){}
  document.documentElement.classList.add('tc-jumping');
  todayLink[0].click();
}

(function(){
  if(!location.href.includes('PRGNAME=SCHEDULER')) return;
  document.documentElement.classList.add('tc-schedule');

  var TIME = /^\d{1,2}:\d{2}$/;
  var DAY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Mo|Di|Mi|Do|Fr|Sa|So)\b/;
  var now = new Date();
  var todayKey = ('0' + now.getDate()).slice(-2) + '.' + ('0' + (now.getMonth() + 1)).slice(-2) + '.';

  function store(key, value){
    try{ if(value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); }catch(e){ return null; }
  }

  // Dim quarter-hour labels so full hours stand out (labels can be td or th).
  $('#pageContent td, #pageContent th').each(function(){
    var t = $(this).text().trim();
    if(/^\d{1,2}:(15|30|45)$/.test(t)) $(this).addClass('tc-quarter');
    else if(/^\d{1,2}:00$/.test(t)) $(this).addClass('tc-hour');
  });

  // TUCaN shortens course names in appointment blocks (cut off, abbreviated or German);
  // the title holds the full English name.
  $('td.appointment a[title]').each(function(){
    var a = $(this), shown = a.text().trim(), full = (a.attr('title') || '').trim();
    if(full.length > shown.length) a.text(full);
  });

  var table = $('td.appointment').first().closest('table');
  if(!table.length) table = $('#pageContent .tc-hour').first().closest('table');
  if(!table.length) return;  // e.g. month view

  var allRows = table.find('tr');
  var timeRows = allRows.filter(function(){ return TIME.test($(this).children().first().text().trim()); });
  if(!timeRows.length) return;

  // ---- Map every cell to its grid column (accounting for rowspan/colspan) ----
  var grid = [], pos = new Map();
  allRows.each(function(r){
    grid[r] = grid[r] || [];
    var c = 0;
    $(this).children('td, th').each(function(){
      while(grid[r][c]) c++;
      var rs = parseInt(this.getAttribute('rowspan'), 10) || 1;
      var cs = parseInt(this.getAttribute('colspan'), 10) || 1;
      for(var i = 0; i < rs; i++){
        grid[r + i] = grid[r + i] || [];
        for(var j = 0; j < cs; j++) grid[r + i][c + j] = this;
      }
      pos.set(this, {row: r, col: c});
      c += cs;
    });
  });

  // Header row = the row whose cells start with weekday names.
  var dayCols = [], headerIndex = -1;
  allRows.each(function(r){
    if(headerIndex >= 0) return;
    var cells = $(this).children('td, th');
    var days = cells.filter(function(){ return DAY.test($(this).text().trim()); });
    if(days.length < 3) return;
    headerIndex = r;
    days.each(function(){
      var p = pos.get(this), cs = parseInt(this.getAttribute('colspan'), 10) || 1;
      var label = $(this).text().replace(/\s+/g, ' ').trim();
      var day = {label: label, today: label.indexOf(todayKey) !== -1, items: []};
      if(day.today) $(this).addClass('tc-today');
      for(var j = 0; j < cs; j++) dayCols[p.col + j] = day;
    });
  });

  // ---- Collect appointments ----
  var days = [];
  dayCols.forEach(function(d){ if(d && days.indexOf(d) < 0) days.push(d); });
  table.find('td.appointment').each(function(){
    var p = pos.get(this), day = p && dayCols[p.col];
    if(!day) return;
    var cell = $(this), text = cell.text().replace(/\s+/g, ' ').trim();
    var m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(text);
    var links = cell.find('a');
    var course = links.last(), rooms = links.not(course);
    var name = course.length ? course.text().trim() : text.replace(m ? m[0] : '', '').trim();
    day.items.push({
      start: m ? m[1] : '', end: m ? m[2] : '',
      name: name,
      href: course.attr('href'), onclick: course.attr('onclick'),
      room: rooms.length
        ? rooms.map(function(){ return $(this).text().trim(); }).get().join(', ')
        : text.replace(m ? m[0] : '', '').replace(name, '').trim()
    });
  });
  function minutes(t){ var a = t.split(':'); return +a[0] * 60 + +a[1]; }
  days.forEach(function(d){ d.items.sort(function(a, b){ return minutes(a.start || '0:0') - minutes(b.start || '0:0'); }); });

  // ---- Agenda view ----
  var agenda = $('<div class="tc-agenda"></div>');
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var next = null, todayIdx = days.findIndex(function(d){ return d.today; });
  days.forEach(function(d, i){
    if(todayIdx >= 0 && i < todayIdx) return;
    d.items.forEach(function(it){
      if(next) return;
      if(i === todayIdx && it.start && minutes(it.end || it.start) <= nowMin) return;
      next = {day: d, item: it};
    });
  });
  if(todayIdx >= 0 && next){
    var when = next.day.today ? 'Today' : next.day.label;
    agenda.append($('<div class="tc-next"></div>')
      .append('<span class="tc-next-label">Next class</span>')
      .append($('<strong></strong>').text(next.item.name))
      .append($('<span></span>').text(when + (next.item.start ? ' · ' + next.item.start + '–' + next.item.end : '') + (next.item.room ? ' · ' + next.item.room : ''))));
  }
  days.forEach(function(d, i){
    var weekend = /^(Sat|Sun|Sa|So)\b/.test(d.label);
    if(weekend && !d.items.length) return;
    var past = todayIdx >= 0 && i < todayIdx;
    var block = $('<div class="tc-day"></div>').toggleClass('tc-day-today', d.today).toggleClass('tc-day-past', past);
    block.append($('<div class="tc-day-label"></div>').text(d.label).append(d.today ? '<span class="tc-pill">Today</span>' : ''));
    var list = $('<div class="tc-day-items"></div>');
    if(!d.items.length) list.append('<div class="tc-free">No classes</div>');
    d.items.forEach(function(it){
      var row = $('<div class="tc-item"></div>');
      row.append($('<span class="tc-time"></span>').text(it.start ? it.start + '–' + it.end : ''));
      var name = $('<a class="tc-name"></a>').text(it.name).attr('href', it.href || '#');
      if(it.onclick) name.attr('onclick', it.onclick);
      row.append(name);
      row.append($('<span class="tc-room"></span>').text(it.room));
      list.append(row);
    });
    block.append(list);
    agenda.append(block);
  });

  // ---- Trim grid to class hours ----
  var first = -1, last = -1;
  timeRows.each(function(i){
    $(this).children('td.appointment').each(function(){
      var span = parseInt(this.getAttribute('rowspan'), 10) || 1;
      if(first < 0 || i < first) first = i;
      last = Math.max(last, i + span - 1);
    });
  });
  var label = function(i){ return timeRows.eq(i).children().first().text().trim(); };
  var offHours = $();
  if(first >= 0){
    while(first > 0 && !/:00$/.test(label(first))) first--;
    last++;
    while(last < timeRows.length - 1 && !/:00$/.test(label(last))) last++;
    offHours = timeRows.filter(function(i){ return i < first || i > last; });
  } else {
    offHours = timeRows;
  }

  // ---- Toolbar: Agenda | Grid, plus full-day toggle for the grid ----
  var gridRows = allRows.filter(function(r){ return headerIndex >= 0 && r >= headerIndex; });
  var view = store('tc-schedule-view') || 'agenda';
  if(!days.length) view = 'grid';  // couldn't read the day headers: keep TUCaN's grid
  var fullDay = false;
  var bar = $('<div class="tc-sched-bar"></div>');
  var seg = $('<div class="tc-seg"></div>');
  var bAgenda = $('<a href="#">Agenda</a>'), bGrid = $('<a href="#">Grid</a>');
  var bFull = $('<a href="#" class="tc-full"></a>');
  seg.append(bAgenda, bGrid);
  bar.append(seg, bFull);
  if(!days.length) seg.hide();

  function render(){
    var isAgenda = view === 'agenda';
    bAgenda.toggleClass('on', isAgenda);
    bGrid.toggleClass('on', !isAgenda);
    agenda.toggle(isAgenda);
    gridRows.toggle(!isAgenda);
    if(!isAgenda) offHours.toggle(fullDay);
    bFull.toggle(!isAgenda && offHours.length > 0).text(fullDay ? 'Class hours only' : 'Show full day');
  }
  bAgenda.on('click', function(e){ e.preventDefault(); view = 'agenda'; store('tc-schedule-view', view); render(); });
  bGrid.on('click', function(e){ e.preventDefault(); view = 'grid'; store('tc-schedule-view', view); render(); });
  bFull.on('click', function(e){ e.preventDefault(); fullDay = !fullDay; render(); });

  // ---- Unified control card: replaces TUCaN's caption + navigation rows ----
  function findLink(re){ return table.find('a').filter(function(){ return re.test($(this).text().replace(/\s+/g, ' ').trim()); }).first(); }
  function proxy(src, text, cls, title){
    if(!src || !src.length) return null;
    var b = $('<a></a>').text(text).attr('href', src.attr('href') || '#');
    if(cls) b.addClass(cls);
    if(title) b.attr('title', title);
    // Some TUCaN links navigate via onclick; forward the click to the original.
    b.on('click', function(e){ e.preventDefault(); src[0].click(); });
    return b;
  }
  var prev = table.find('a.img_arrowLeft').first(), nextLink = table.find('a.img_arrowRight').first();
  var todayLink = findLink(/^(Today|Heute)$/);

  // Title: "Week 43" + date range, read from the week selector ("CW 43 19.10.2026 - 25.10.2026").
  var select = table.find('select').first();
  var picked = select.find('option:selected').text().replace(/\s+/g, ' ').trim();
  var wk = /(?:CW|KW)\s*(\d+)\s+(\d{2}\.\d{2}\.)\d{4}\s*-\s*(\d{2}\.\d{2}\.\d{4})/.exec(picked);
  var title = $('<div class="tc-week-title"></div>').append('<em class="tc-eyebrow">Schedule</em>');
  if(wk) title.append($('<strong></strong>').text('Week ' + wk[1]), $('<span></span>').text(wk[2] + ' – ' + wk[3]));
  else {
    var cap = table.find('td, th').filter(function(){ return /^(Schedule for|Terminplan)/i.test($(this).text().trim()); }).first();
    title.append($('<strong></strong>').text(cap.length ? cap.text().trim() : 'Schedule'));
  }

  var stepper = $('<div class="tc-stepper"></div>');
  [proxy(prev, '‹', 'tc-icon', 'Previous (←)'), proxy(todayLink, 'Today', 'tc-today-btn'), proxy(nextLink, '›', 'tc-icon', 'Next (→)')]
    .forEach(function(b){ if(b) stepper.append(b); });

  // View switcher, with the current view highlighted (inferred from the visible columns).
  var shownDays = days.length;
  var current = shownDays <= 1 ? 'day' : shownDays <= 5 ? 'work' : 'week';
  var views = $('<div class="tc-seg tc-views"></div>');
  [['day', /^(Day|Tag)$/, 'Day'], ['week', /^(Week|Woche)$/, 'Week'], ['work', /^(Working week|Arbeitswoche)$/, 'Work week'], ['month', /^(Month|Monat)$/, 'Month']]
    .forEach(function(v){ var b = proxy(findLink(v[1]), v[2]); if(b){ b.toggleClass('on', v[0] === current); views.append(b); } });

  // Week picker mirrors TUCaN's select and applies the choice right away.
  var picker = null;
  if(select.length){
    picker = $('<select class="tc-picker"></select>');
    select.find('option').each(function(){
      var t = $(this).text().replace(/\s+/g, ' ').trim();
      var m = /(?:CW|KW)\s*(\d+)\s+(\d{2}\.\d{2}\.)\d{4}\s*-\s*(\d{2}\.\d{2}\.\d{4})/.exec(t);
      picker.append($('<option></option>').val(this.value).text(m ? 'Week ' + m[1] + ' · ' + m[2] + ' – ' + m[3] : t).prop('selected', this.selected));
    });
    var refresh = table.find('a, input[type="submit"], input[type="image"], button').filter(function(){
      return /^(Refresh|Aktualisieren)$/i.test(($(this).text() || this.value || '').trim());
    }).first();
    picker.on('change', function(){
      select.val(this.value);
      select[0].dispatchEvent(new Event('change', {bubbles: true}));
      if(!select.attr('onchange') && refresh.length) refresh[0].click();
    });
  }
  var print = proxy(findLink(/^(Printable version|Druckversion)$/), '', 'tc-icon tc-print', 'Printable version');

  var top = $('<div class="tc-sched-top"></div>').append(title, stepper);
  var controls = $('<div class="tc-sched-controls"></div>').append(seg, views);
  var right = $('<div class="tc-sched-right"></div>');
  if(picker) right.append(picker);
  if(print) right.append(print);
  right.append(bFull);
  controls.append(right);
  bar.empty().addClass('tc-card').append(top, controls);

  // Hide TUCaN's own caption/navigation rows (kept in the page so its form still works).
  if(headerIndex > 0) allRows.filter(function(r){ return r < headerIndex; }).addClass('tc-tucan-nav').hide();

  // Hide the "Schedule for 31.08. to 06.09." caption wherever TUCaN put it.
  hideBlock($('#pageContent').find('td, th, div, caption').filter(function(){
    return $(this).children().length === 0 && /^(Schedule for|Terminplan (für|vom))/i.test($(this).text().trim());
  }), table);

  // Opening the schedule from elsewhere (e.g. the top menu) can land on an old week.
  // Jump to the current one, but only on arrival - not while browsing weeks.
  jumpToTodayOnArrival(todayIdx >= 0, todayLink);

  // Keyboard: ← / → step (ignored while typing in a field).
  $(document).on('keydown', function(e){
    if(e.altKey || e.ctrlKey || e.metaKey || $(e.target).is('input, select, textarea')) return;
    if(e.key === 'ArrowLeft' && prev.length){ e.preventDefault(); prev[0].click(); }
    if(e.key === 'ArrowRight' && nextLink.length){ e.preventDefault(); nextLink[0].click(); }
  });

  table.before(bar);
  table.after(agenda);
  render();
})();
