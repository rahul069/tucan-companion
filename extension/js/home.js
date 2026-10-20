// Start page (My TUCaN): greeting, Today/Messages cards side by side, quick-link tiles.

(function(){
  if(!location.href.includes('PRGNAME=MLSSTART')) return;
  var content = $('#pageContent');
  var h1 = content.find('h1').first();
  if(!h1.length) return;
  document.documentElement.classList.add('tc-home');

  // ---- Greeting ----
  var now = new Date(), hour = now.getHours();
  var hello = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  var name = (/(?:Welcome|Willkommen),?\s+(.+?)!?\s*$/i.exec(h1.text().trim()) || [])[1] || '';
  var first = name.split(/\s+/)[0];
  var dateLine = now.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  var hero = $('<div class="tc-hero"></div>')
    .append($('<h1></h1>').text(hello + (first ? ', ' + first : '')))
    .append($('<div class="tc-hero-date"></div>').text(dateLine));
  h1.replaceWith(hero);
  // "Activities for: 16.10.2026" repeats the date.
  content.find('h2, h3, p, div').filter(function(){ return $(this).children().length === 0 && /^(Activities for|Aktivitäten für)/i.test($(this).text().trim()); }).hide();

  // ---- Today / Messages cards ----
  function leaf(re){
    return content.find('*').filter(function(){
      return $(this).children().length === 0 && re.test($(this).text().trim());
    }).first();
  }
  var headings = [
    {re: /^(Today'?s Events|Heutige Termine|Termine heute)/i, title: 'Today', icon: '', cls: 'tc-card-today'},
    {re: /^(Incoming messages|Eingegangene Nachrichten|Neue Nachrichten)/i, title: 'Messages', icon: '', cls: 'tc-card-msgs'}
  ];
  var found = headings.map(function(h){ var el = leaf(h.re); return el.length ? $.extend({el: el}, h) : null; }).filter(Boolean);
  // Climb from each heading to the largest block that doesn't also hold the other heading.
  found.forEach(function(f){
    var node = f.el;
    var others = found.filter(function(o){ return o !== f; }).map(function(o){ return o.el[0]; });
    while(node.parent().length && !node.parent().is(content) &&
          !others.some(function(o){ return $.contains(node.parent()[0], o); })) node = node.parent();
    f.block = node;
  });
  // Only regroup whole blocks (tables/divs); never pull single rows out of a table.
  if(found.some(function(f){ return f.block.is('tr, td, th, tbody, thead'); })) found = [];
  if(found.length){
    var grid = $('<div class="tc-home-grid"></div>');
    found[0].block.before(grid);
    found.forEach(function(f){
      var card = $('<section class="tc-home-card"></section>').addClass(f.cls);
      card.append($('<div class="tc-home-card-head"></div>').append($('<span class="tc-home-icon"></span>').text(f.icon), $('<span></span>').text(f.title)));
      f.el.hide();  // our card header replaces TUCaN's
      card.append(f.block);
      grid.append(card);
    });
    // Empty states
    grid.find('*').filter(function(){
      return $(this).children().length === 0 && /^(There are no appointments|You have no new messages|Es sind keine Termine|Sie haben keine neuen)/i.test($(this).text().trim());
    }).addClass('tc-empty').each(function(){
      var t = $(this).text().trim();
      if(/appointments|Termine/i.test(t)) $(this).text('No classes or appointments today');
      else $(this).text('No new messages');
    });
  }

  // ---- Quick links (taken from TUCaN's own menu) ----
  var nav = $('#pageTopNavi');
  function navLink(re){ return nav.find('a').filter(function(){ return re.test($(this).text().replace(/\s+/g, ' ').trim()); }).first(); }
  var tiles = [
    [/^(Schedule|Stundenplan|Terminplan)$/, 'Schedule', ''],
    [/^(My Examinations|Meine Prüfungen)$/, 'My exams', ''],
    [/^(Module Results|Modulergebnisse)$/, 'Module results', ''],
    [/^(Performance Record|Leistungsspiegel)$/, 'Performance record', ''],
    [/^(Registration|Anmeldung)$/, 'Registration', ''],
    [/^(Messages|Nachrichten)$/, 'Messages', '']
  ];
  var quick = $('<div class="tc-quick"></div>');
  tiles.forEach(function(t){
    var a = navLink(t[0]);
    if(!a.length) return;
    quick.append($('<a class="tc-tile"></a>').attr('href', a.attr('href'))
      .append($('<span class="tc-tile-icon"></span>').text(t[2]), $('<span></span>').text(t[1])));
  });
  if(quick.children().length){
    var target = content.find('.tc-home-grid');
    (target.length ? target : hero).after($('<div class="tc-quick-wrap"></div>').append('<div class="tc-section-label">Quick links</div>', quick));
  }
})();
