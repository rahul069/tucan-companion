// Grade distribution popup (PRGNAME=GRADEOVERVIEW): summary tiles and a bar chart
// built from TUCaN's "grade | number of students" table.

(function(){
  if(!location.href.includes('PRGNAME=GRADEOVERVIEW')) return;
  var table = document.querySelector('#pageContentPopUp table.nb') || document.querySelector('table.nb');
  if(!table) return;
  var rows = Array.prototype.filter.call(table.querySelectorAll('tr'), function(tr){ return tr.children.length > 2; });
  if(rows.length < 2) return;

  var cells = function(tr){ return Array.prototype.slice.call(tr.children, 1).map(function(td){ return td.textContent.trim(); }); };
  var labels = cells(rows[0]);
  var counts = cells(rows[1]).map(function(t){ var n = parseInt(t, 10); return isNaN(n) ? 0 : n; });
  var grades = labels.map(function(l){ return parseFloat(l.replace(',', '.')); });
  var total = counts.reduce(function(a, b){ return a + b; }, 0);
  if(!total) return;

  var failed = 0, weighted = 0, graded = 0;
  grades.forEach(function(g, i){
    if(isNaN(g)) return;
    if(g >= 5) failed += counts[i];
    weighted += g * counts[i];
    graded += counts[i];
  });
  var passRate = (total - failed) / total * 100;
  var average = graded ? weighted / graded : NaN;
  var peak = Math.max.apply(null, counts);
  var fmt = function(n, d){ return n.toFixed(d).replace('.', ','); };

  var box = document.createElement('section');
  box.className = 'tc-grades';

  var tiles = document.createElement('div');
  tiles.className = 'tc-grade-tiles';
  [['Participants', String(total)],
   ['Average grade', isNaN(average) ? '–' : fmt(average, 2)],
   ['Passed', fmt(passRate, 1) + ' %'],
   ['Failed', fmt(100 - passRate, 1) + ' %']].forEach(function(t, i){
    var tile = document.createElement('div');
    tile.className = 'tc-grade-tile' + (i === 2 ? ' tc-good' : i === 3 ? ' tc-bad' : '');
    tile.innerHTML = '<span></span><strong></strong>';
    tile.firstChild.textContent = t[0];
    tile.lastChild.textContent = t[1];
    tiles.appendChild(tile);
  });
  box.appendChild(tiles);

  var meter = document.createElement('div');
  meter.className = 'tc-pass-meter';
  meter.innerHTML = '<div></div>';
  meter.firstChild.style.width = passRate + '%';
  box.appendChild(meter);

  var chart = document.createElement('div');
  chart.className = 'tc-histogram';
  labels.forEach(function(label, i){
    var col = document.createElement('div');
    col.className = 'tc-hist-col' + (grades[i] >= 5 ? ' tc-bad' : '');
    col.title = counts[i] + ' students (' + fmt(counts[i] / total * 100, 1) + ' %)';
    col.innerHTML = '<span class="tc-hist-share"></span><div class="tc-hist-track"><div class="tc-hist-bar"></div></div><span class="tc-hist-label"></span>';
    col.querySelector('.tc-hist-share').textContent = counts[i] ? fmt(counts[i] / total * 100, 0) + '%' : '';
    col.querySelector('.tc-hist-bar').style.height = (counts[i] / peak * 100) + '%';
    col.querySelector('.tc-hist-label').textContent = label;
    chart.appendChild(col);
  });
  box.appendChild(chart);

  var note = document.createElement('p');
  note.className = 'tc-grade-note';
  note.textContent = 'Statistics calculated by TUCaN Companion from the table below.';
  box.appendChild(note);

  table.parentNode.insertBefore(box, table);
})();
