// Optional TUPlan integration (https://www.tuplan.courses), used with TUPlan's permission.
// Off by default; turned on in the popup ("Grade averages from TUPlan").
//  - ⌀ badges next to module numbers, from TUPlan's public grade digest (cached for a day)
//  - on grade statistics pages: a button to share the anonymous distribution with TUPlan
// If TUPlan's own extension is installed it already does both, so we step aside.

(function(){
  var TUPLAN = 'https://www.tuplan.courses';
  // API key for reports: the key from TUPlan's own extension, which TUPlan allowed us to use.
  // Without a key the share button explains that sharing isn't available.
  var REPORT_KEY = 'ghu9E9cjFBQMP-SLBABdpGIRgfoMaLAfdzemKqASypY';
  var BUCKETS = ['1.0', '1.3', '1.7', '2.0', '2.3', '2.7', '3.0', '3.3', '3.7', '4.0', '5.0'];
  var CODE = /^(\d{2}-[a-z0-9]{2}-[a-z0-9]{3,6})(-[\p{L}\p{N}]{1,8})?$/iu;
  var text = function(el){ return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); };
  var moduleId = function(id){ return id.split('-').slice(0, 3).join('-'); };
  var fmt = function(n){ return n.toFixed(2); };
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }

  // On Module Results, remember which module a Ø (grade statistics) link belongs to: the
  // statistics page itself only shows the title.
  if(location.href.includes('PRGNAME=COURSERESULTS')){
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a');
      if(!a || !/GRADEOVERVIEW/.test((a.getAttribute('href') || '') + (a.getAttribute('onclick') || ''))) return;
      var row = a.closest('tr'), code = row && (/(\d{2}-[a-z0-9]{2}-[a-z0-9]{4})/i.exec(text(row)) || [])[1];
      if(!code) return;
      try{ localStorage.setItem('tc-grade-context', JSON.stringify({code: code, at: Date.now()})); } catch(err){}
    }, true);
  }

  chrome.storage.local.get(['tuplanEnabled', 'tuplanDigest'], function(s){
    if(!s.tuplanEnabled) return;
    if(location.href.includes('PRGNAME=GRADEOVERVIEW')) reportButton();
    loadDigest(s.tuplanDigest).then(function(digest){
      if(!digest) return;
      drawBadges(digest);
      // The degree-progress view (and other parts) render later or redraw; keep up with them.
      var pending = null;
      new MutationObserver(function(){
        clearTimeout(pending);
        pending = setTimeout(function(){ drawBadges(digest); }, 200);
      }).observe(document.getElementById('pageContent') || document.body, {childList: true, subtree: true});
    });
  });

  function loadDigest(cached){
    if(cached && Date.now() - cached.at < 24 * 3600e3) return Promise.resolve(cached.data);
    return fetch(TUPLAN + '/api/grades/digest', {credentials: 'omit'})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if(!d || d.version !== 1 || !d.courses) return cached ? cached.data : null;
        chrome.storage.local.set({tuplanDigest: {at: Date.now(), data: d}});
        return d;
      })
      .catch(function(){ return cached ? cached.data : null; });
  }

  // ---------- Badges ----------
  function latest(course){
    return course.snapshots.slice().sort(function(a, b){ return termKey(b.term) - termKey(a.term); })[0];
  }
  function termKey(term){
    var m = /(WiSe|SoSe)\s*(\d{4})/i.exec(term || '');
    return m ? +m[2] * 2 + (/wise/i.test(m[1]) ? 1 : 0) : 0;
  }
  function overall(course){
    var n = 0, sum = 0;
    course.snapshots.forEach(function(s){ n += s.totalResults; sum += s.average * s.totalResults; });
    return n ? {average: sum / n, results: n, terms: course.snapshots.length} : null;
  }

  function badge(id, course){
    var all = overall(course);
    if(!all) return null;
    var b = el('span', 'tc-tuplan', '⌀ ' + fmt(all.average));
    b.tabIndex = 0;
    b.dataset.module = id;
    b.setAttribute('aria-label', 'TUPlan grade average ' + fmt(all.average));
    b.addEventListener('mouseenter', function(){ showCard(b, id, course); });
    b.addEventListener('focus', function(){ showCard(b, id, course); });
    b.addEventListener('mouseleave', hideCard);
    b.addEventListener('blur', hideCard);
    return b;
  }

  function drawBadges(digest){
    if(document.querySelector('.tuplan-badge')){  // TUPlan's own extension is active
      document.querySelectorAll('.tc-tuplan').forEach(function(b){ b.remove(); });
      return;
    }
    var root = document.getElementById('pageContent') || document.body;
    // Module numbers shown on their own: code chips, and table cells holding just a code.
    var targets = root.querySelectorAll('a.tc-code, span.tc-code, td');
    Array.prototype.forEach.call(targets, function(node){
      if(node.tagName === 'TD' && (node.children.length > 1 || node.querySelector('.tc-code'))) return;
      var m = CODE.exec(text(node));
      if(!m) return;
      var id = moduleId(m[1] + (m[2] || ''));
      var course = digest.courses[id];
      var next = node.nextElementSibling;
      if(!course || (next && next.classList.contains('tc-tuplan')) || node.querySelector('.tc-tuplan')) return;
      var b = badge(id, course);
      if(!b) return;
      if(node.tagName === 'TD') node.appendChild(b); else node.insertAdjacentElement('afterend', b);
    });
  }

  var card = null;
  function showCard(anchor, id, course){
    hideCard();
    var all = overall(course), last = latest(course);
    card = el('div', 'tc-tuplan-card');
    card.appendChild(el('div', 'tc-tuplan-card-head', id + ' · ' + course.title));
    var stat = el('div', 'tc-tuplan-card-stat');
    stat.appendChild(el('strong', null, '⌀ ' + fmt(all.average)));
    stat.appendChild(el('span', null, all.results + ' results · ' + all.terms + (all.terms === 1 ? ' semester' : ' semesters')));
    card.appendChild(stat);
    if(last){
      card.appendChild(el('div', 'tc-tuplan-card-sub', last.term + ' · ⌀ ' + fmt(last.average)));
      var peak = Math.max.apply(null, last.buckets) || 1, hist = el('div', 'tc-tuplan-hist');
      last.buckets.forEach(function(n, i){
        var col = el('div', 'tc-tuplan-col' + (i === BUCKETS.length - 1 ? ' tc-bad' : ''));
        var bar = el('i'); bar.style.height = Math.max(2, n / peak * 100) + '%';
        col.appendChild(bar); col.appendChild(el('span', null, BUCKETS[i].replace('.', ',')));
        col.title = n + ' × ' + BUCKETS[i];
        hist.appendChild(col);
      });
      card.appendChild(hist);
    }
    card.appendChild(el('div', 'tc-tuplan-card-foot', 'Grade averages from TUPlan (tuplan.courses), reported by students — not official TU data.'));
    document.body.appendChild(card);
    var r = anchor.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    var top = r.bottom + 6 + h > innerHeight ? r.top - h - 6 : r.bottom + 6;
    card.style.left = left + 'px'; card.style.top = Math.max(8, top) + 'px';
  }
  function hideCard(){ if(card){ card.remove(); card = null; } }

  // ---------- Share a grade distribution ----------
  function readReport(){
    var heading = Array.prototype.map.call(document.querySelectorAll('h1, h2, h3, caption, .tbhead'), text)
      .map(function(t){ return /^(?:(\d{2}-[a-z0-9]{2}-[a-z0-9]{3,6}(?:-[\p{L}\p{N}]{1,8})?)\s+)?(.+),\s*((?:WiSe|WS|SoSe|SS|Wintersemester|Sommersemester)\s*\d{4}(?:\s*\/\s*\d{2,4})?)$/iu.exec(t); })
      .find(Boolean);
    if(!heading) return {error: 'Couldn\'t find the course title and semester on this page.'};
    var id = heading[1];
    if(!id){
      try{
        var ctx = JSON.parse(localStorage.getItem('tc-grade-context') || 'null');
        if(ctx && Date.now() - ctx.at < 10 * 60e3) id = ctx.code;
      } catch(e){}
    }
    if(!id) return {error: 'Couldn\'t tell which module this is. Open the statistics from Module Results or Examination Results.'};
    var t = heading[3].replace(/\s+/g, ' ');
    var y = /(\d{4})(?:\s*\/\s*(\d{2,4}))?/.exec(t);
    var term = /^(WiSe|WS|Winter)/i.test(t) ? 'WiSe ' + y[1] + '/' + String(+y[1] + 1).slice(-2) : 'SoSe ' + y[1];

    var table = document.querySelector('#pageContentPopUp table.nb') || document.querySelector('table.nb');
    var rows = table ? Array.prototype.filter.call(table.querySelectorAll('tr'), function(tr){ return tr.children.length > 2; }) : [];
    if(rows.length < 2) return {error: 'Couldn\'t find the grade table.'};
    var grades = Array.prototype.slice.call(rows[0].children, 1).map(function(td){ return text(td).replace(',', '.'); });
    var counts = Array.prototype.slice.call(rows[1].children, 1).map(function(td){ return parseInt(text(td), 10) || 0; });
    var buckets = {};
    grades.forEach(function(g, i){ if(BUCKETS.indexOf(g) >= 0) buckets[g] = counts[i]; });
    var total = BUCKETS.reduce(function(s, b){ return s + (buckets[b] || 0); }, 0);
    if(!total) return {error: 'The grade table is empty — nothing to share yet.'};

    var page = document.body.innerText;
    var num = function(re){ var m = re.exec(page); return m ? parseFloat(m[1].replace(',', '.')) : null; };
    var average = num(/(?:Average|Durchschnitt)\s*:?\s*([\d,.]+)/i);
    if(!average) return {error: 'Couldn\'t read the average.'};
    return {report: {
      tucanId: id, title: heading[2].trim(), term: term, buckets: buckets, average: average,
      totalResults: num(/(?:Available Results|Vorliegende Ergebnisse)\s*:?\s*(\d+)/i) || total,
      missingIll: num(/(?:Missing|Fehlend)[^\n:]*(?:Krankschreibung|sick)[^\n:]*:?\s*(\d+)/i),
      missingNoReason: num(/(?:Missing|Fehlend)[^\n:]*(?:without reason|ohne Grund)[^\n:]*:?\s*(\d+)/i),
      deviatingScaleResults: num(/(?:differing GS|abweichende)[^\n:]*:?\s*(\d+)/i),
      source: 'EXTENSION'
    }};
  }

  function reportButton(){
    if(document.querySelector('.tuplan-bar')) return;  // TUPlan's own extension already offers this
    var target = document.querySelector('.tc-grades') || document.querySelector('#pageContentPopUp table.nb') || document.querySelector('table.nb');
    if(!target) return;
    var bar = el('div', 'tc-tuplan-share');
    var info = el('div');
    info.appendChild(el('strong', null, 'Share with TUPlan'));
    info.appendChild(el('span', null, 'Sends only this anonymous table (module, semester, number of students per grade, average) to tuplan.courses, so other students can see how this module is graded. Never your name, ID or own grade.'));
    var btn = el('button', 'tc-tuplan-btn', 'Share distribution');
    var status = el('div', 'tc-tuplan-status');
    bar.appendChild(info); bar.appendChild(btn); bar.appendChild(status);
    target.parentNode.insertBefore(bar, target.nextSibling);

    btn.addEventListener('click', function(){
      var r = readReport();
      if(r.error){ status.textContent = r.error; status.className = 'tc-tuplan-status tc-bad'; return; }
      if(!REPORT_KEY){
        status.textContent = 'Sharing with TUPlan isn\'t available in this build.';
        status.className = 'tc-tuplan-status tc-bad';
        return;
      }
      btn.disabled = true; btn.textContent = 'Sharing…';
      fetch(TUPLAN + '/api/grades/report', {
        method: 'POST', credentials: 'omit',
        headers: {'content-type': 'application/json', 'x-api-key': REPORT_KEY},
        body: JSON.stringify(r.report)
      }).then(function(res){ return res.json().catch(function(){ return null; }).then(function(body){ return {ok: res.ok, status: res.status, body: body}; }); })
        .then(function(res){
          if(!res.ok) throw new Error((res.body && res.body.error) || 'TUPlan said ' + res.status);
          var outcome = res.body && res.body.outcome;
          status.textContent = outcome === 'UNCHANGED' ? 'TUPlan already has this distribution. Thanks!'
            : outcome === 'STORED_NEEDS_REVIEW' ? 'Received — TUPlan will review it before showing it.'
            : 'Shared. Thank you for helping other students!';
          status.className = 'tc-tuplan-status tc-good';
          btn.textContent = 'Shared ✓';
        })
        .catch(function(err){
          status.textContent = 'Couldn\'t share: ' + err.message;
          status.className = 'tc-tuplan-status tc-bad';
          btn.disabled = false; btn.textContent = 'Try again';
        });
    });
  }
})();
