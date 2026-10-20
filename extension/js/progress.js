// Performance record (PRGNAME=STUDENT_RESULT): degree progress.
//  - per area: credits counted vs. the area's minimum/maximum, plus what's in progress
//  - this semester's modules: credits and the area each one counts towards
//  - overall: counted / required credits
// Extra data comes from TUCaN itself (My Modules, My Registrations, the registration
// tree), fetched in the background with your session and cached in this browser.

(function(){
  if(!location.href.includes('PRGNAME=STUDENT_RESULT')) return;
  var table = document.querySelector('#pageContent table');
  if(!table) return;

  var CODE = /^(\d{2}-[a-z0-9]{2}-[a-z0-9]{4})/i;
  var num = function(t){ var m = /(\d+(?:[.,]\d+)?)/.exec(t || ''); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
  var fmt = function(n){ return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); };
  var text = function(el){ return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); };
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }

  // ---------- 1. Read the record ----------
  function cellsOf(tr){
    var out = [];
    Array.prototype.forEach.call(tr.children, function(td){
      for(var i = 0; i < (parseInt(td.getAttribute('colspan'), 10) || 1); i++) out.push(td);
    });
    return out;
  }
  var rows = Array.prototype.filter.call(table.querySelectorAll('tr'), function(tr){ return tr.closest('table') === table; });
  var col = {};
  rows.some(function(tr){
    var heads = cellsOf(tr).map(text);
    var c = heads.findIndex(function(h){ return /^(Credits|CP|Leistungspunkte)$/i.test(h); });
    var a = heads.findIndex(function(h){ return /^(Accounted|Angerechnet|Counted)$/i.test(h); });
    if(c < 0 || a < 0) return false;
    col = {credits: c, accounted: a, header: tr, width: heads.length};
    return true;
  });
  if(!col.header) return;

  var areas = [], modules = [], stack = [], lastSummed = null, required = NaN;
  var levelOf = function(tr){ var m = /level(\d+)/.exec(tr.className + ' ' + (tr.firstElementChild || {}).className); return m ? +m[1] : 99; };
  rows.forEach(function(tr){
    if(tr === col.header) return;
    var cells = cellsOf(tr), first = text(cells[0]);
    var line = text(tr);
    if(/(graduation|Abschluss)\D*(\d+[.,]\d)/i.test(line) && tr.children.length <= 2){ required = num(/(\d+[.,]\d)\s*$/.exec(line)[1]); return; }
    if(tr.children.length === 1 && lastSummed){
      // "A minimum of 18,0 credits must be achieved. A maximum of 30,0 credits will be counted."
      var min = /(minimum of|mindestens)\s*(\d+[.,]\d)/i.exec(line), max = /(maximum of|maximal|höchstens)\s*(\d+[.,]\d)/i.exec(line);
      var exact = /(In this area|In diesem Bereich werden)\s*(\d+[.,]\d)/i.exec(line);
      if(min) lastSummed.min = num(min[2]);
      if(max) lastSummed.max = num(max[2]);
      if(exact) lastSummed.min = lastSummed.max = num(exact[2]);
      if(min || max || exact) lastSummed.ruleRow = tr;
      return;
    }
    if(/^(Sum|Summe)\b/i.test(first)){
      var name = first.replace(/^(Sum|Summe)\s*/i, '');
      var area = null;
      for(var i = stack.length - 1; i >= 0; i--) if(text(stack[i].head.firstElementChild) === name){ area = stack[i]; break; }
      area = area || stack[stack.length - 1];
      if(!area) return;
      area.sumRow = tr;
      area.counted = num(text(cells[col.accounted])) || 0;
      lastSummed = area;
      return;
    }
    if(CODE.test(first)){
      var status = /pass/.test(tr.innerHTML) && !/incomplete|open\.gif/.test(tr.innerHTML) ? 'passed'
        : /fail|nicht bestanden|\bfailed\b/i.test(tr.innerHTML) ? 'failed'
        : /incomplete|unvollständig/i.test(tr.innerHTML) ? 'incomplete' : 'open';
      var mod = {code: CODE.exec(first)[1], row: tr, nameCell: cells[1], nameEl: cells[1].querySelector('a') || cells[1], status: status,
                 credits: num(text(cells[col.credits])), area: stack[stack.length - 1]};
      modules.push(mod);
      if(mod.area) mod.area.modules.push(mod);
      return;
    }
    if(tr.classList.contains('subhead') || /level\d/.test(tr.className)){
      var lvl = levelOf(tr);
      while(stack.length && stack[stack.length - 1].level >= lvl) stack.pop();
      var a = {head: tr, level: lvl, parent: stack[stack.length - 1] || null, modules: [], children: [], counted: 0};
      if(a.parent) a.parent.children.push(a);
      stack.push(a); areas.push(a);
    }
  });
  if(!areas.length) return;
  var areaName = function(a){ return text(a.head.firstElementChild); };  // read late: translate.js may have run
  var root = areas[0];

  // ---------- 2. Extra data from TUCaN (cached) ----------
  var CACHE_KEY = 'tc-progress-v3';
  function load(){ try{ return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch(e){ return {}; } }
  function save(c){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch(e){} }
  var cache = load();
  var fresh = function(key, hours){ return cache[key] && Date.now() - cache[key].at < hours * 3600e3; };

  function navLink(prg){
    var a = document.querySelector('#pageTopNavi a[href*="PRGNAME=' + prg + '&"], #pageTopNavi a[href*="PRGNAME=' + prg + '"]');
    return a ? a.href : null;
  }
  async function getDoc(url, init){
    var r = await fetch(url, Object.assign({credentials: 'include'}, init || {}));
    var buf = await r.arrayBuffer(), html;
    try{ html = new TextDecoder('utf-8', {fatal: true}).decode(buf); } catch(e){ html = new TextDecoder('windows-1252').decode(buf); }
    return new DOMParser().parseFromString(html, 'text/html');
  }
  // Module rows ("code, name, …, credits") from a list of table rows.
  function moduleRows(trs){
    var out = [];
    Array.prototype.forEach.call(trs, function(tr){
      var cells = Array.prototype.map.call(tr.children, text);
      var i = cells.findIndex(function(c){ return CODE.test(c); });
      if(i < 0) return;
      var code = CODE.exec(cells[i])[1];
      var link = Array.prototype.find.call(tr.querySelectorAll('a'), function(a){ return text(a) && !CODE.test(text(a)) && !/^(Cancel|Details|Abmelden)$/i.test(text(a)); });
      var cp = NaN;
      for(var j = cells.length - 1; j > i; j--){ if(/^\d+,\d$/.test(cells[j])){ cp = num(cells[j]); break; } }
      out.push({code: code, name: link ? text(link) : cells[i].replace(CODE, '').trim(), credits: cp,
                url: link && link.getAttribute('href') ? new URL(link.getAttribute('href'), location.href).href : ''});
    });
    return out;
  }

  // Credits of every module you've had (My Modules, semester "<All>").
  async function allModules(){
    if(fresh('modules', 12)) return cache.modules.data;
    var url = navLink('MYMODULES'); if(!url) return {};
    var doc = await getDoc(url), form = doc.querySelector('#pageContent form'), sel = form && form.querySelector('select[name="semester"]');
    if(form && sel && sel.querySelector('option[value="999"]')){
      var body = new URLSearchParams();
      form.querySelectorAll('input[type="hidden"]').forEach(function(i){ body.append(i.name, i.value); });
      body.append('semester', '999');
      doc = await getDoc(new URL(form.getAttribute('action') || url, url).href, {method: 'POST', body: body});
    }
    var data = {};
    moduleRows(doc.querySelectorAll('#pageContent table tr')).forEach(function(m){ if(!isNaN(m.credits)) data[m.code] = m; });
    cache.modules = {at: Date.now(), data: data}; save(cache);
    return data;
  }

  // This semester's module registrations (My Current Registrations, "Accepted module registrations").
  async function currentModules(){
    if(fresh('current', 6)) return cache.current.data;
    var url = navLink('MYREGISTRATIONS'); if(!url) return [];
    var doc = await getDoc(url), inModules = false, picked = [];
    // Sections follow each other as header rows; keep the rows of "Accepted module registrations".
    doc.querySelectorAll('#pageContent tr').forEach(function(tr){
      var t = text(tr);
      if(/^(Accepted module registrations|Angenommene Modulanmeldungen)/i.test(t)){ inModules = true; return; }
      if(/^(Pending|Accepted|Rejected|Offene|Angenommene|Abgelehnte)\b.*(registrations|anmeldungen)$/i.test(t)){ inModules = false; return; }
      if(inModules) picked.push(tr);
    });
    var data = moduleRows(picked).filter(function(m){ return !/-\w{2,3}$/.test(m.code); });
    cache.current = {at: Date.now(), data: data}; save(cache);
    return data;
  }

  // Which elective area offers a module: walk the registration tree, skipping the huge
  // catalogues (general studies, languages …). About 15–20 pages, cached for a week.
  var SKIP = /^(General Education|Studium Generale|Wahlbereich Sprachen|Languages|Remedial Coursework|Auflagen|Additional Courses|Zusatzleistungen|Master Thesis|Masterarbeit)$/i;
  async function areaMap(){
    if(fresh('areas', 24 * 7)) return cache.areas.data;
    var start = navLink('REGISTRATION'); if(!start) return {};
    var seen = {}, queue = [{url: start, name: ''}], data = {}, pages = 0;
    while(queue.length && pages < 30){
      var item = queue.shift();
      if(seen[item.url]) continue;
      seen[item.url] = 1; pages++;
      var doc = await getDoc(item.url);
      doc.querySelectorAll('#pageContent ul li a').forEach(function(a){
        var n = text(a);
        if(/PRGNAME=REGISTRATION/.test(a.getAttribute('href') || '') && !SKIP.test(n)) queue.push({url: new URL(a.getAttribute('href'), item.url).href, name: n});
      });
      doc.querySelectorAll('#pageContent table a').forEach(function(a){
        var m = CODE.exec(text(a));
        if(m && item.name){ var c = m[1].slice(0, 10); (data[c] = data[c] || []).indexOf(item.name) < 0 && data[c].push(item.name); }
      });
      await new Promise(function(r){ setTimeout(r, 120); });
    }
    cache.areas = {at: Date.now(), data: data}; save(cache);
    return data;
  }

  // A page with a semester dropdown: the default semester plus the next older ones.
  async function semesterPages(prg, count){
    var url = navLink(prg); if(!url) return [];
    var doc = await getDoc(url), form = doc.querySelector('#pageContent form'), sel = form && form.querySelector('select');
    if(!sel) return [{label: '', doc: doc}];
    var opts = Array.prototype.filter.call(sel.options, function(o){ return o.value !== '999'; });
    var i = Math.max(0, opts.findIndex(function(o){ return o.selected; }));
    var out = [{label: text(opts[i]), doc: doc}];
    for(var k = 1; k < count && opts[i + k]; k++){
      var body = new URLSearchParams();
      form.querySelectorAll('input[type="hidden"]').forEach(function(h){ body.append(h.name, h.value); });
      body.append(sel.name, opts[i + k].value);
      out.push({label: text(opts[i + k]), doc: await getDoc(new URL(form.getAttribute('action') || url, url).href, {method: 'POST', body: body})});
    }
    return out;
  }

  // Modules whose final grade is "not set yet" (Module Results, last three semesters).
  async function pendingResults(){
    if(fresh('results', 6)) return cache.results.data;
    var data = [];
    // The first page is the running semester: "not set yet" there just means the course isn't over.
    (await semesterPages('COURSERESULTS', 3)).forEach(function(pg, index){
      pg.doc.querySelectorAll('#pageContent table tr').forEach(function(tr){
        var cells = Array.prototype.map.call(tr.children, text);
        if(!CODE.test(cells[0] || '') || !cells.some(function(c){ return /^(not set yet|noch nicht gesetzt|nicht gesetzt)$/i.test(c); })) return;
        var cp = cells.find(function(c){ return /^\d+,\d$/.test(c); });
        data.push({code: CODE.exec(cells[0])[1], name: cells[1], credits: cp ? num(cp) : NaN, semester: pg.label, current: index === 0});
      });
    });
    cache.results = {at: Date.now(), data: data}; save(cache);
    return data;
  }

  // Latest exam attempt per module (Examination Results): sick note, failed, absent …
  var ATTEMPT = [[/Krankschreibung|sick note/i, 'sick note'], [/nicht ausreichend|nicht bestanden|insufficient|failed/i, 'failed'],
                 [/nicht erschienen|absent/i, 'absent'], [/entschuldigt|excused/i, 'excused'], [/zurückgetreten|withdrawn/i, 'withdrawn']];
  async function attempts(){
    if(fresh('attempts', 6)) return cache.attempts.data;
    var data = {};
    (await semesterPages('EXAMRESULTS', 2)).forEach(function(pg){
      pg.doc.querySelectorAll('#pageContent table tr').forEach(function(tr){
        var t = text(tr), m = CODE.exec(text(tr.children[0]));
        if(!m) return;
        var kind = ATTEMPT.find(function(a){ return a[0].test(t); });
        var date = (/(\d{2}\.\d{2}\.\d{4})/.exec(t) || [])[1] || '';
        var key = m[1].slice(0, 10), stamp = date ? date.split('.').reverse().join('') : '';
        if(!data[key] || stamp > data[key].stamp) data[key] = {result: kind ? kind[1] : 'graded', date: date, stamp: stamp};
      });
    });
    cache.attempts = {at: Date.now(), data: data}; save(cache);
    return data;
  }

  // Registration-tree names → areas on this record.
  function findArea(names, code){
    if(/^41-/.test(code)) names = (names || []).concat(['Wahlbereich Sprachen', 'Elective Area: Languages', 'Languages']);
    var leaves = areas.filter(function(a){ return a.sumRow && !a.children.length; });
    for(var i = 0; i < (names || []).length; i++){
      var n = names[i].toLowerCase();
      var hit = leaves.find(function(a){ return areaName(a).toLowerCase() === n; }) ||
        (/seminar|lab|practical|praktik/i.test(n) && leaves.find(function(a){ return /studienbegleitend|accompanying/i.test(areaName(a)); })) ||
        (/language|sprach/i.test(n) && leaves.find(function(a){ return /sprach|language/i.test(areaName(a)); }));
      if(hit) return hit;
    }
    return null;
  }

  // ---------- 3. Show it ----------
  var summary = el('section', 'tc-progress');
  table.parentNode.insertBefore(summary, table);

  function bar(done, pending, target){
    var b = el('div', 'tc-pbar'), full = Math.max(target || 0, done + pending, 1);
    var d = el('span', 'tc-pbar-done'); d.style.width = Math.min(100, done / full * 100) + '%';
    var p = el('span', 'tc-pbar-pending'); p.style.width = Math.min(100 - done / full * 100, pending / full * 100) + '%';
    b.appendChild(d); b.appendChild(p);
    if(target && target < full){ var mk = el('i', 'tc-pbar-mark'); mk.style.left = (target / full * 100) + '%'; b.appendChild(mk); }
    return b;
  }

  var extra = {results: [], attempts: {}};
  function render(credits, current, map){
    // In progress = on the record but not passed, plus this semester's modules not on it yet.
    var onRecord = {};
    modules.forEach(function(m){ onRecord[m.code] = m; });
    var pending = [];
    modules.forEach(function(m){
      if(m.status === 'passed') return;
      var cp = !isNaN(m.credits) && m.credits > 0 ? m.credits : (credits[m.code] || {}).credits;
      pending.push({code: m.code, name: text(m.nameEl), credits: cp, area: m.area, onRecord: true, status: m.status, url: (credits[m.code] || {}).url});
    });
    current.forEach(function(c){
      if(onRecord[c.code] && onRecord[c.code].status === 'passed') return;
      if(pending.some(function(p){ return p.code === c.code; })){
        pending.forEach(function(p){ if(p.code === c.code){ p.thisSemester = true; if(isNaN(p.credits)) p.credits = c.credits; } });
        return;
      }
      pending.push({code: c.code, name: (credits[c.code] || c).name, credits: c.credits, area: findArea(map[c.code], c.code), onRecord: false, thisSemester: true, url: (credits[c.code] || c).url});
    });

    // Exams written but no grade yet.
    extra.results.forEach(function(r){
      if(onRecord[r.code] && onRecord[r.code].status === 'passed') return;
      var p = pending.find(function(x){ return x.code === r.code; });
      if(p){ if(r.current) p.thisSemester = true; else p.resultPending = r.semester; if(isNaN(p.credits)) p.credits = r.credits; return; }
      pending.push({code: r.code, name: r.name, credits: r.credits, area: findArea(map[r.code], r.code), onRecord: false,
                    thisSemester: r.current, resultPending: r.current ? null : r.semester, url: (credits[r.code] || {}).url});
    });

    var under = function(area, a){ for(; a; a = a.parent) if(a === area) return true; return false; };
    var pendingIn = function(area){ return pending.filter(function(p){ return under(area, p.area); }).reduce(function(s, p){ return s + (p.credits || 0); }, 0); };

    // Overall card
    var counted = root.counted || 0, target = isNaN(required) ? (root.min || 0) : required;
    var inProg = pending.reduce(function(s, p){ return s + (p.credits || 0); }, 0);
    // What will actually count: each area passes up at most its remaining room (maximum − counted).
    function effective(area){
      var own = pending.filter(function(p){ return p.area === area; }).reduce(function(s, p){ return s + (p.credits || 0); }, 0);
      var sum = own + area.children.reduce(function(s, c){ return s + effective(c); }, 0);
      var cap = isNaN(area.max) ? Infinity : Math.max(0, area.max - (area.counted || 0));
      return Math.min(sum, cap);
    }
    var willCount = Math.min(effective(root), Math.max(0, target - counted));
    var short = areas.filter(function(a){ return a.sumRow && !a.children.length && !isNaN(a.min); }).map(function(a){
      return {name: areaName(a), gap: a.min - (a.counted || 0) - effective(a)};
    }).filter(function(x){ return x.gap > 0.05; });
    var shortText = short.length ? 'Still short: ' + short.map(function(x){ return x.name + ' (' + fmt(x.gap) + ')'; }).join(', ') : 'Every area\'s minimum met';
    summary.textContent = '';
    var head = el('div', 'tc-progress-head');
    head.appendChild(el('strong', null, 'Degree progress'));
    head.appendChild(el('span', null, fmt(counted) + ' of ' + fmt(target) + ' credits counted'));
    summary.appendChild(head);
    summary.appendChild(bar(counted, willCount, target));
    var legend = el('div', 'tc-legend');
    [['tc-key-done', 'Counted (passed)'], ['tc-key-pending', 'In progress, counts if you pass'], ['tc-key-mark', 'Area minimum']].forEach(function(k){
      var item = el('span'); item.appendChild(el('i', k[0])); item.appendChild(document.createTextNode(k[1])); legend.appendChild(item);
    });
    legend.appendChild(el('span', 'tc-legend-sep', '|'));
    [['tc-ok', 'Minimum reached'], ['tc-soon', 'Enough if you pass'], ['tc-need', 'Still missing credits']].forEach(function(k){
      legend.appendChild(el('span', 'tc-legend-text ' + k[0], k[1]));
    });
    summary.appendChild(legend);
    var facts = el('div', 'tc-progress-facts');
    [['Counted', fmt(counted) + ' CP'],
     ['In progress', fmt(inProg) + ' CP', willCount < inProg ? fmt(willCount) + ' CP of it can count (area limits)' : 'all of it can count'],
     ['Still needed', fmt(Math.max(0, target - counted)) + ' CP'],
     ['If you pass everything', fmt(Math.max(0, target - counted - willCount)) + ' CP left', shortText]].forEach(function(f){
      var d = el('div'); d.appendChild(el('span', null, f[0])); d.appendChild(el('strong', null, f[1]));
      if(f[2]) d.appendChild(el('small', null, f[2]));
      facts.appendChild(d);
    });
    summary.appendChild(facts);
    var waiting = pending.filter(function(p){ return p.resultPending; });
    if(waiting.length){
      var cp = waiting.reduce(function(s, p){ return s + (p.credits || 0); }, 0);
      summary.appendChild(el('p', 'tc-waiting', '⏳ ' + waiting.length + (waiting.length === 1 ? ' result' : ' results') + ' pending (' + fmt(cp) + ' CP): ' +
        waiting.map(function(p){ return p.name + ' (' + p.resultPending + ')'; }).join(', ')));
    }

    // This semester / in progress list
    if(pending.length){
      var list = el('div', 'tc-pending');
      list.appendChild(el('div', 'tc-pending-title', 'In progress — where the credits will count'));
      var t = el('table', 'tc-pending-table');
      var hr = el('tr'); ['Module', 'Credits', 'Counts towards', 'Status'].forEach(function(h){ hr.appendChild(el('th', null, h)); }); t.appendChild(hr);
      // Same order as the record: by area (Foundations, Models and Methods, …), then this semester's first.
      var order = function(p){ var i = areas.indexOf(p.area); return i < 0 ? 1e6 : i; };
      pending.sort(function(a, b){ return order(a) - order(b) || (b.thisSemester ? 1 : 0) - (a.thisSemester ? 1 : 0) || a.code.localeCompare(b.code); });
      pending.forEach(function(p){
        var tr = el('tr');
        // The code is a link starting with the module number: other TUCaN tools (e.g. TUPlan's
        // grade badges) recognise links like that and can add their info next to it.
        var chip = el('a', 'tc-code', p.code);
        if(p.url) chip.href = p.url;
        var name = el('td'); name.appendChild(chip); name.appendChild(document.createTextNode(' ' + (p.name || ''))); tr.appendChild(name);
        tr.appendChild(el('td', 'tc-num', isNaN(p.credits) || p.credits == null ? '–' : fmt(p.credits) + ' CP'));
        var where = p.area ? areaName(p.area) : ((map[p.code] || []).join(', ') || (p.resultPending ? 'Not on your record yet' : 'Not assigned yet'));
        tr.appendChild(el('td', p.area ? null : 'tc-muted', where));
        var last = extra.attempts[p.code];
        var status = p.resultPending ? 'Result pending · ' + p.resultPending
          : p.thisSemester ? (p.onRecord ? 'This semester · ' + p.status + (last && last.result !== 'graded' ? ' (last attempt: ' + last.result + ')' : '') : 'This semester · registered')
          : p.status + (last && last.result !== 'graded' ? ' · last attempt: ' + last.result + (last.date ? ' (' + last.date + ')' : '') : '');
        tr.appendChild(el('td', p.resultPending ? 'tc-result-pending' : 'tc-muted', status));
        t.appendChild(tr);
      });
      list.appendChild(t);
      list.appendChild(el('p', 'tc-pending-note', 'Credits count once you pass. An area only counts up to its maximum. "Counts towards" for new modules is where TUCaN offers them this semester; TUCaN assigns the area when you register for the exam.'));
      summary.appendChild(list);
    }

    // Per area: a line under each area with rules
    table.querySelectorAll('tr.tc-area-progress').forEach(function(r){ r.remove(); });
    areas.forEach(function(a){
      if(!a.sumRow || (isNaN(a.min) && isNaN(a.max)) || a === root) return;
      var min = isNaN(a.min) ? 0 : a.min, max = isNaN(a.max) ? Infinity : a.max, done = a.counted || 0, wip = pendingIn(a);
      var tr = el('tr', 'tc-area-progress'), td = el('td');
      td.colSpan = col.width;
      var msg, cls, room = max === Infinity ? Infinity : Math.max(0, max - done);
      var counts = Math.min(wip, room);
      var wipText = wip ? fmt(wip) + ' CP in progress' + (wip > room ? ' (only ' + fmt(room) + ' will count)' : '') : '';
      if(max !== Infinity && done >= max){ msg = 'Full: the maximum of ' + fmt(max) + ' CP is reached, more modules here won\'t count'; cls = 'tc-ok'; }
      else if(done >= min){ msg = [min ? 'Minimum reached' : 'No minimum', wipText || (room !== Infinity ? 'up to ' + fmt(room) + ' more CP can count' : '')].filter(Boolean).join(' · '); cls = 'tc-ok'; }
      else{
        var need = min - done;
        msg = fmt(need) + ' more CP needed' + (wip ? ' · ' + wipText + (counts >= need ? ', enough if you pass' : ', ' + fmt(need - counts) + ' still missing') : '');
        cls = counts >= need ? 'tc-soon' : 'tc-need';
      }
      var line = el('div', 'tc-area-line ' + cls);
      line.appendChild(bar(done, counts, min || (max === Infinity ? 0 : max)));
      line.appendChild(el('span', 'tc-area-count', fmt(done) + (min ? ' / ' + fmt(min) : '') + ' CP'));
      line.appendChild(el('span', 'tc-area-msg', msg));
      line.title = fmt(done) + ' CP counted' + (wip ? ', ' + fmt(counts) + ' CP in progress that can count' : '') +
        (min ? ', minimum ' + fmt(min) + ' CP' : '') + (max !== Infinity ? ', maximum ' + fmt(max) + ' CP' : '');
      td.appendChild(line); tr.appendChild(td);
      var after = a.ruleRow || a.sumRow;
      after.parentNode.insertBefore(tr, after.nextSibling);
    });

    // In-progress modules on the record: show their credits
    modules.forEach(function(m){
      if(m.status === 'passed' || m.row.querySelector('.tc-wip')) return;
      var p = pending.find(function(x){ return x.code === m.code; });
      if(!p || !p.credits) return;
      m.nameCell.appendChild(el('span', 'tc-wip', (p.thisSemester ? 'this semester · ' : 'in progress · ') + fmt(p.credits) + ' CP'));
    });
  }

  // Draw straight away from the last saved data (so the list is there when other tools scan
  // the page), then redraw only if TUCaN's data turned out different.
  var shown = null;
  function show(credits, current, map){
    var sig = JSON.stringify([credits, current, map, extra]);
    if(sig === shown) return;
    shown = sig;
    render(credits, current, map);
  }
  var hasCache = cache.modules && cache.current;
  if(cache.results) extra.results = cache.results.data;
  if(cache.attempts) extra.attempts = cache.attempts.data;
  show(hasCache ? cache.modules.data : {}, hasCache ? cache.current.data : [], cache.areas ? cache.areas.data : {});
  if(!hasCache) summary.appendChild(el('p', 'tc-progress-loading', 'Loading credits of your current modules from TUCaN…'));
  (async function(){
    try{
      var credits = await allModules();
      extra.results = await pendingResults();
      extra.attempts = await attempts();
      var current = await currentModules();
      var unknown = current.concat(extra.results).some(function(c){ return !modules.some(function(m){ return m.code === c.code; }) && !/^41-/.test(c.code); });
      var map = unknown ? await areaMap() : (cache.areas ? cache.areas.data : {});
      show(credits, current, map);
    } catch(e){
      var n = summary.querySelector('.tc-progress-loading');
      if(n) n.textContent = 'Couldn\'t load your current modules from TUCaN (' + e.message + ').';
    }
  })();
})();
