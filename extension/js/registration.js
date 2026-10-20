// Registration page: compact breadcrumb + category cards instead of a link chain and a bullet list.

(function(){
  // The area browser (REGISTRATION) and the registration steps (REGCOURSEMOD, ...).
  if(!/PRGNAME=(REGISTRATION|REGCOURSE)/.test(location.href)) return;
  document.documentElement.classList.add('tc-registration');
  var content = $('#pageContent');

  // Category lists: plain lists where every item is a single link ("pick a sub-area").
  var cats = content.find('ul').filter(function(){
    var items = $(this).children('li');
    return items.length > 0 && items.toArray().every(function(li){
      var links = $(li).children('a');
      return links.length === 1 && $(li).children().length === 1;
    });
  }).addClass('tc-cats');

  // Breadcrumb: the first block (outside lists/tables) holding two or more links in a row.
  var crumbs = content.find('h2, h3, p, div, span').filter(function(){
    var el = $(this);
    return el.children('a').length >= 2 && !el.find('ul, table, h1').length && !el.closest('ul, table').length;
  }).first();
  if(crumbs.length){
    crumbs.addClass('tc-crumbs');
    // Drop TUCaN's text separators (">", "»", "/") between the links; we draw our own.
    crumbs.contents().filter(function(){ return this.nodeType === 3 && /^[\s>»›\/|-]*$/.test(this.nodeValue); }).remove();
    // TUCaN often repeats an area as its own sub-level; drop neighbouring duplicates.
    crumbs.children('a').each(function(){
      var prev = $(this).prevAll('a').first();
      if(prev.length && prev.text().trim() === $(this).text().trim()) prev.remove();
    });
    var links = crumbs.children('a');
    links.last().addClass('tc-crumb-current');
    // Collapse a long path: keep the first and the last two, put the rest behind "…".
    if(links.length > 4){
      var middle = links.slice(1, -2);
      var more = $('<a href="#" class="tc-crumb-more" title="Show full path">…</a>').on('click', function(e){
        e.preventDefault(); crumbs.removeClass('tc-crumbs-collapsed'); $(this).remove();
      });
      middle.first().before(more);
      middle.addClass('tc-crumb-mid');
      crumbs.addClass('tc-crumbs-collapsed');
    }
    // TUCaN repeats the current category as the only card; label it so it reads as "open".
    var current = links.last().text().trim();
    cats.find('a').filter(function(){ return $(this).text().trim() === current; }).addClass('tc-cat-current');
  }

  // Register / deregister and the step navigation as real buttons.
  content.find('a, input[type="submit"], input[type="button"], button').each(function(){
    var t = ($(this).text() || this.value || '').trim();
    if(/^(Register|Anmelden)$/i.test(t)) $(this).addClass('tc-btn tc-btn-go');
    else if(/^(Next|Weiter|Continue|Send|Submit|Absenden|Confirm|Bestätigen)$/i.test(t)) $(this).addClass('tc-btn tc-btn-go tc-btn-next');
    else if(/^(Back|Zurück|Previous)$/i.test(t)) $(this).addClass('tc-btn tc-btn-back');
    else if(/^(Deregister|Abmelden|Cancel|Cancel registration)$/i.test(t)) $(this).addClass('tc-btn tc-btn-stop');
  });

  // Module list tables: the caption repeats the page title and the five-line column
  // legend isn't needed once rows are cards - hide both.
  content.find('table').has('a.tc-btn, td').each(function(){
    var t = $(this);
    if(!t.find('a.tc-btn').length) return;
    t.find('tr').each(function(){
      var row = $(this), text = row.text().replace(/\s+/g, ' ').trim();
      if(/^(Registration for modules and courses|Anmeldung zu Modulen und Veranstaltungen)$/i.test(text) ||
         /(Course offering|Veranstaltungsangebot).*(Instructors|Lehrende)/i.test(text)) row.addClass('tc-reg-head').hide();
    });
  });

  // ---- Module rows as course cards ----
  // Codes look like 20-00-0449 or 18-kp-1010, optionally with a part suffix (-iv, -ue, -vl).
  var CODE = /^(\d{2}-[a-z0-9]{2}-\d{4})(-[\w]+)?\s+(.*?)\s*(?:\(((?:WiSe|SoSe|WS|SS)[^)]*)\))?\s*$/i;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var plain = function(el){ return $(el).text().replace(/\s+/g, ' ').trim(); };
  content.find('tr').each(function(){
    var row = $(this);
    // A plain-text row repeating the course that the next row links to: drop the duplicate.
    if(!row.find('a').length && CODE.test(plain(row))){
      var nextLink = row.next('tr').find('a').filter(function(){ return plain(this) === plain(row); });
      if(nextLink.length){ row.addClass('tc-dup').hide(); return; }
    }
    var link = row.find('a').not('.tc-btn').filter(function(){ return CODE.test(plain(this)); }).first();
    if(!link.length) return;
    if(link.length){
      var m = CODE.exec(link.text().replace(/\s+/g, ' ').trim());
      var card = $('<span class="tc-course"></span>')
        .append($('<span class="tc-code"></span>').text(m[1] + (m[2] || '')))
        .append($('<span class="tc-title"></span>').text(m[3]));
      if(m[4]) card.append($('<span class="tc-term"></span>').text(m[4]));
      link.empty().append(card).addClass('tc-course-link');
      // Parts of a module (e.g. 20-00-0449-iv) sit under their module.
      if(m[2]) row.addClass('tc-subrow');
      row.addClass('tc-course-row');
    }
    // Deadline countdown next to the first date in the row.
    row.children('td').each(function(){
      var cell = $(this), d = /(\d{2})\.(\d{2})\.(\d{4})/.exec(cell.text());
      if(!d || cell.find('.tc-due').length || cell.find('a.tc-course-link').length) return;
      var due = new Date(+d[3], +d[2] - 1, +d[1]);
      var days = Math.round((due - today) / 86400000);
      var badge = $('<span class="tc-due"></span>');
      if(days < 0) badge.addClass('tc-due-closed').text('Closed');
      else if(days === 0) badge.addClass('tc-due-soon').text('Closes today');
      else if(days <= 7) badge.addClass('tc-due-soon').text(days + (days === 1 ? ' day left' : ' days left'));
      else badge.addClass('tc-due-ok').text(days + ' days left');
      cell.addClass('tc-deadline').append(badge);
      return false;
    });
    // "- | 156" = max participants | registered  ->  "156 registered" / "40 / 50 registered"
    row.find('td').contents().filter(function(){ return this.nodeType === 3 && /^\s*(\d+|-)\s*\|\s*(\d+)\s*$/.test(this.nodeValue); }).each(function(){
      var m = /^\s*(\d+|-)\s*\|\s*(\d+)\s*$/.exec(this.nodeValue);
      $(this).replaceWith($('<span class="tc-seats"></span>').text(m[1] === '-' ? m[2] + ' registered' : m[2] + ' / ' + m[1] + ' registered'));
    });
  });

  // Blank bars TUCaN puts at the top of tables.
  content.find('tr').filter(function(){
    var r = $(this);
    return !r.text().trim() && !r.find('input, select, textarea, img, button, a').length;
  }).addClass('tc-blank-row').hide();

  // Key/value tables (No. / Name / Studies) as a summary card.
  content.find('table').each(function(){
    var rows = $(this).children('tbody').children('tr').add($(this).children('tr')).filter(':visible');
    var kv = rows.filter(function(){
      var cells = $(this).children('td, th');
      return cells.length === 2 && cells.first().text().trim().length > 0 && cells.first().text().trim().length < 25 && !$(this).find('a.tc-btn').length;
    });
    if(rows.length && kv.length >= 2 && kv.length >= rows.length - 2){
      kv.addClass('tc-kv-row');
      kv.children(':first-child').addClass('tc-kv-label');
      kv.filter(function(){ return /^(Name|Titel|Title)$/i.test($(this).children().first().text().trim()); }).addClass('tc-kv-name');
      $(this).addClass('tc-kv');
    }
  });

  // The "Next" step button: make sure there's one at the bottom too, where you finish reading.
  var nextBtn = content.find('.tc-btn-next').first();
  if(nextBtn.length && !content.find('.tc-step-footer').length){
    var copy = $('<a class="tc-btn tc-btn-go"></a>').text(nextBtn.text().trim() || nextBtn.val()).attr('href', nextBtn.attr('href') || '#')
      .on('click', function(e){ e.preventDefault(); nextBtn[0].click(); });
    content.append($('<div class="tc-step-footer"></div>').append(copy));
  }

  // A one-word hint above the cards.
  if(cats.length) cats.first().before('<div class="tc-cats-hint">Choose an area</div>');
})();
